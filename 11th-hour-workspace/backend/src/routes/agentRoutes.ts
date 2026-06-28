import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { GoogleGenerativeAI, SchemaType, Schema as GenAISchema } from '@google/generative-ai';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { ReadinessLog } from '../models/ReadinessLog';
import { PlanRevision } from '../models/PlanRevision';
import { getOAuthClient } from './calendarRoutes';

const router = Router();

// Helper to compute free gaps in the calendar
function getFreeGaps(now: Date, endOfToday: Date, busySlots: { start: string; end: string }[]) {
  const parsedBusy = busySlots
    .map(slot => ({
      start: new Date(slot.start),
      end: new Date(slot.end)
    }))
    .filter(slot => !isNaN(slot.start.getTime()) && !isNaN(slot.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: { start: Date; end: Date }[] = [];
  let lastTime = now.getTime();

  for (const slot of parsedBusy) {
    const slotStart = slot.start.getTime();
    const slotEnd = slot.end.getTime();

    // If there is a gap of at least 5 minutes, record it
    if (slotStart > lastTime + 5 * 60 * 1000) {
      gaps.push({
        start: new Date(lastTime),
        end: new Date(slotStart)
      });
    }
    if (slotEnd > lastTime) {
      lastTime = slotEnd;
    }
  }

  const endOfTodayTime = endOfToday.getTime();
  if (endOfTodayTime > lastTime + 5 * 60 * 1000) {
    gaps.push({
      start: new Date(lastTime),
      end: new Date(endOfTodayTime)
    });
  }

  return gaps;
}

router.post('/daily-replan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, firebaseId, triggerType } = req.body;

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId is required.' });
      return;
    }

    // 1. Resolve User
    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        // Handle invalid ObjectId gracefully
      }
    }

    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId });
    }

    if (!user) {
      console.log(`User not found for daily-replan. Creating test user...`);
      user = await User.create({
        firebaseId: firebaseId || `test-fb-${Date.now()}`,
        email: 'testuser@example.com',
        calendarSyncEnabled: false
      });
    }

    // 2. Fetch all Pending or In-Progress tasks
    const openTasks = await Task.find({
      userId: user._id,
      status: { $ne: 'Completed' }
    });

    // 3. Fetch user's absolute latest Readiness Log
    const latestLog = await ReadinessLog.findOne({ userId: user._id }).sort({ logDate: -1 });

    let score = 75;
    if (latestLog && latestLog.logDate) {
      const timeDiff = Date.now() - latestLog.logDate.getTime();
      if (timeDiff < 86400000) {
        score = latestLog.calculatedScore;
      }
    }
    console.log(`Resolved daily readiness score: ${score} (Is mock default: ${score === 75})`);

    // 4. Fetch Google Calendar Free/Busy Time Windows
    let busySlots: { start: string; end: string }[] = [];
    let freeGaps: { start: string; end: string }[] = [];
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    if (user.googleAccessToken) {
      try {
        const oauth2Client = getOAuthClient(user);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const fbResponse = await calendar.freebusy.query({
          requestBody: {
            timeMin: now.toISOString(),
            timeMax: endOfToday.toISOString(),
            items: [{ id: 'primary' }]
          }
        });

        const primaryCal = fbResponse.data.calendars?.primary;
        if (primaryCal && primaryCal.busy) {
          busySlots = primaryCal.busy.map((slot: any) => ({
            start: slot.start || '',
            end: slot.end || ''
          }));
        }
      } catch (err: any) {
        console.warn('Warning: Failed to fetch calendar freebusy windows, defaulting to empty:', err.message || err);
      }
    }

    // Compute gaps
    const calculatedGaps = getFreeGaps(now, endOfToday, busySlots);
    freeGaps = calculatedGaps.map(g => ({
      start: g.start.toISOString(),
      end: g.end.toISOString()
    }));

    // 5. Initialize gemini-3.1-flash-lite
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: `You are an autonomous productivity agent. Your task is to evaluate today's tasks, the user's readiness score, and today's free calendar gaps to recommend a list of schedule modifications.
Current local time is: ${now.toLocaleString()}.
You must apply these rules strictly:
1. Cognitive Load Cap: Today's scheduled tasks cannot exceed a hard ceiling of 15 aggregate cognitiveLoad points. (Calculated by summing the cognitiveLoad of all active, scheduled tasks for today). If the sum exceeds 15, you must select lower-priority tasks to 'downgrade' (reduce cognitive load) or 'requeue' (defer to tomorrow).
2. Energy Level Drop: If the readiness score is below 60, any task with a cognitiveLoad >= 4 must be automatically deferred or pushed to later in the evening (action 'reslot' or 'requeue'), citing the low score as the transparent logic justification in the reason field.
3. Schedule slots: When recommending 'reslot' or 'rechunk', assign proposed start and end times (proposedSlot.start and proposedSlot.end) that fit cleanly inside the provided free calendar gaps.
4. Output Formatting: Return a JSON array matching the response schema. Every modification must contain a clear, human-readable, one-sentence explanation in the reason field. Do not modify tasks that do not need changes.`
    });

    const planChangeSchema: GenAISchema = {
      type: SchemaType.OBJECT,
      properties: {
        taskId: {
          type: SchemaType.STRING,
          description: 'The MongoDB ObjectId of the task as a string.'
        },
        action: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['reslot', 'rechunk', 'downgrade', 'draft-message', 'requeue'],
          description: 'The action taken on the task.'
        },
        reason: {
          type: SchemaType.STRING,
          description: 'A clear, human-readable, one-sentence explanation for this plan modification, citing the mathematical rules (e.g. score below 60, total load > 15).'
        },
        proposedSlot: {
          type: SchemaType.OBJECT,
          properties: {
            start: {
              type: SchemaType.STRING,
              description: 'ISO-8601 Date string for the proposed start time.'
            },
            end: {
              type: SchemaType.STRING,
              description: 'ISO-8601 Date string for the proposed end time.'
            }
          },
          description: 'The proposed slot start/end times if action is reslot or rechunk.'
        },
        draftMessage: {
          type: SchemaType.STRING,
          description: 'The draft message context if action is draft-message.'
        }
      },
      required: ['taskId', 'action', 'reason']
    };

    const responseSchema: GenAISchema = {
      type: SchemaType.ARRAY,
      description: 'List of task revisions proposed by the agent.',
      items: planChangeSchema
    };

    const payload = {
      readinessScore: score,
      freeCalendarGaps: freeGaps,
      tasks: openTasks.map(t => ({
        taskId: t._id.toString(),
        title: t.title,
        quadrant: t.quadrant,
        cognitiveLoad: t.cognitiveLoad,
        estimatedDuration: t.estimatedDuration,
        externallyDependent: t.externallyDependent,
        status: t.status
      }))
    };

    const prompt = `Here is today's context payload:
${JSON.stringify(payload, null, 2)}

Analyze the tasks against the readiness score and free calendar gaps, and output the required PlanRevision modifications as a JSON array.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const responseText = result.response.text();
    const parsedChanges = JSON.parse(responseText);

    if (!Array.isArray(parsedChanges)) {
      throw new Error('Gemini did not return a valid array of changes.');
    }

    // 6. Map and save PlanRevision document
    const planRevisionChanges = [];
    for (const c of parsedChanges) {
      const matchingTask = openTasks.find(t => t._id.toString() === c.taskId);
      if (matchingTask) {
        let proposedSlot = undefined;
        if (c.proposedSlot && c.proposedSlot.start && c.proposedSlot.end) {
          const startD = new Date(c.proposedSlot.start);
          const endD = new Date(c.proposedSlot.end);
          if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            proposedSlot = { start: startD, end: endD };
          }
        }
        planRevisionChanges.push({
          taskId: matchingTask._id,
          action: c.action,
          reason: c.reason,
          proposedSlot,
          draftMessage: c.draftMessage
        });
      }
    }

    const planRevision = new PlanRevision({
      userId: user._id,
      triggerType: triggerType || 'manual',
      changes: planRevisionChanges,
      userConfirmed: false
    });

    await planRevision.save();

    // Populate task information before returning to avoid 'Untitled Task' population issues
    const populatedPlan = await PlanRevision.findById(planRevision._id).populate('changes.taskId');

    res.status(200).json({
      success: true,
      message: `Daily replan proposals generated. Proposed adjustments for ${planRevisionChanges.length} task(s).`,
      score,
      planRevision: populatedPlan || planRevision
    });

  } catch (error: any) {
    console.error('Error in /api/agent/daily-replan:', error);
    res.status(500).json({
      error: 'Failed to complete daily replan execution.',
      details: error.message || error
    });
  }
});

// GET /api/agent/plan-revisions/latest
router.get('/plan-revisions/latest', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, firebaseId } = req.query;

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId is required.' });
      return;
    }

    let user: any = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) {}
    }
    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId: firebaseId as string });
    }

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Retrieve the absolute latest plan revision populated with task details
    const latestPlan = await PlanRevision.findOne({ userId: user._id })
      .sort({ generatedAt: -1 })
      .populate('changes.taskId');

    res.status(200).json({
      success: true,
      planRevision: latestPlan
    });
  } catch (error: any) {
    console.error('Error fetching latest plan revision:', error);
    res.status(500).json({
      error: 'Failed to retrieve latest plan revision.',
      details: error.message || error
    });
  }
});

// POST /api/agent/plan-revisions/:id/confirm
router.post('/plan-revisions/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Find the PlanRevision document
    const planRevision = await PlanRevision.findById(id);
    if (!planRevision) {
      res.status(404).json({ error: 'Plan revision not found.' });
      return;
    }

    // 2. Set userConfirmed: true and save
    planRevision.userConfirmed = true;
    planRevision.confirmedAt = new Date();
    await planRevision.save();

    // 3. Iterate through changes and physically update the Task documents
    if (planRevision.changes && planRevision.changes.length > 0) {
      for (const change of planRevision.changes) {
        if (!change.taskId) continue;

        const updates: any = {};
        // Logic map: If the AI action is requeue or downgrade, update the task's matrixQuadrant / quadrant to 'Schedule' (to defer it)
        if (change.action === 'requeue' || change.action === 'downgrade') {
          updates.quadrant = 'Schedule';
        }

        if (Object.keys(updates).length > 0) {
          await Task.findByIdAndUpdate(change.taskId, updates, { new: true });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Plan revision successfully confirmed and tasks updated in DB.',
      planRevision
    });
  } catch (error: any) {
    console.error('Error confirming plan revision:', error);
    res.status(500).json({
      error: 'Failed to confirm plan revision.',
      details: error.message || error
    });
  }
});

export default router;
