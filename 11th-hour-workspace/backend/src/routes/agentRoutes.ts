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

    // 2. Fetch active tasks strictly for Q1 (Do First) to prevent scope leak of Q3/other tasks
    const activeTasks = await Task.find({
      userId: user._id,
      isCompleted: false,
      $or: [
        { matrixQuadrant: 'Do_First' },
        { quadrant: 'Do' }
      ]
    });

    const currentLoad = activeTasks.reduce((sum, t) => sum + (t.cognitiveLoad || 0), 0);
    const dailyLimit = 15;

    console.log('--- READINESS DIAGNOSTIC ---');
    console.log('Active Q1 Tasks Found:', activeTasks.length);
    console.log('Total Active Load:', currentLoad);
    console.log('Daily Limit:', dailyLimit);

    // Fetch tasks on the bench: Q2 tasks due today or earlier, and Q3 tasks
    const benchEndOfToday = new Date();
    benchEndOfToday.setHours(23, 59, 59, 999);

    const promotableTasks = await Task.find({
      userId: user._id,
      isCompleted: false,
      $or: [
        { matrixQuadrant: 'Schedule', 'scheduleConstraint.targetDate': { $lte: benchEndOfToday } },
        { matrixQuadrant: 'Delegate' } // Q3 tasks
      ]
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
      systemInstruction: `You are an autonomous productivity agent. Your task is to evaluate today's tasks (which are strictly Q1 'Do First' tasks), the user's readiness score, and today's free calendar gaps to recommend a list of schedule modifications.
Current local time is: ${now.toLocaleString()}.
You must apply these rules strictly:
1. Cognitive Load Cap: Today's scheduled Q1 tasks cannot exceed a hard ceiling of 15 aggregate cognitiveLoad points. (Calculated by summing the cognitiveLoad of all active Q1 tasks for today). If the sum exceeds 15, you must select tasks to defer or downgrade to bring the load under the limit.
2. Energy Level Drop: If the readiness score is below 60, any Q1 task with a cognitiveLoad >= 4 must be automatically deferred or downgraded.
3. Output Formatting: Return a JSON array matching the response schema. Every modification must contain a clear, human-readable, one-sentence explanation in the reason field. Do not modify tasks that do not need changes.
   - You must generate a UNIQUE, 1-sentence reason for why each specific task is being adjusted. Do NOT output generic statements about exceeding the cognitive limit. Evaluate the task's title. Example: 'Since your readiness is low today, studying for Operating Systems can be pushed to tomorrow morning when your focus is higher.'

CRITICAL INSTRUCTION: You are evaluating the 'Do First' (Urgent & Important) queue. If the currentLoad exceeds the dailyLimit, you MUST propose defer/downgrade/promote actions to bring the load under the limit, regardless of how important or urgent they are. The user lacks the physical capacity to complete them today. Do not hesitate to defer high-priority tasks to tomorrow.

When proposing to remove a task from the 'Do First' (Q1) queue due to overload, you must evaluate its gravity:
- If it is a critical core objective or heavy project (e.g., major exam prep), use action 'defer_to_schedule' (to postpone it to tomorrow).
- If it is lighter practice, reading, or 'fluff' (e.g., 'Read a chapter', 'Solve 2 problems'), use action 'downgrade_to_shallow' to move it to the user's Shallow Work (Q3) quadrant so they can clear it out with low energy today.

If currentLoad < dailyLimit, you are in 'Surplus Mode'. The user has spare cognitive bandwidth today.
Look at the provided promotableTasks. You must propose the promote action to move tasks from the bench into the 'Do First' queue, up to the remaining capacity (dailyLimit - currentLoad).
Prioritize Q2 tasks that are due today. If there is still space, promote Q3 tasks to clear them out.
Provide an encouraging 1-sentence reason (e.g., 'Since your readiness is high, you have the bandwidth to tackle this scheduled exam prep today.').`
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
          enum: ['defer_to_schedule', 'downgrade_to_shallow', 'promote'],
          description: 'The action taken on the task: defer_to_schedule (move to Q2), downgrade_to_shallow (move to Q3), or promote (move to Q1).'
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
      currentLoad,
      dailyLimit,
      freeCalendarGaps: freeGaps,
      tasks: activeTasks.map(t => ({
        taskId: t._id.toString(),
        title: t.title,
        quadrant: t.quadrant,
        cognitiveLoad: t.cognitiveLoad,
        estimatedDuration: t.estimatedDuration,
        externallyDependent: t.externallyDependent,
        status: t.status
      })),
      promotableTasks: promotableTasks.map(t => ({
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
      const matchingTask = activeTasks.find(t => t._id.toString() === c.taskId) || promotableTasks.find(t => t._id.toString() === c.taskId);
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
    const { approvedTaskIds } = req.body; // Array of taskId strings checked on the frontend

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

    // 3. Iterate through changes and physically update the Task documents using Smart Deferral logic
    if (planRevision.changes && planRevision.changes.length > 0) {
      // Filter to execute only for tasks the user approved (checked)
      const approvedChanges = planRevision.changes.filter(change => 
        change.taskId && approvedTaskIds && approvedTaskIds.includes(change.taskId.toString())
      );

      for (const change of approvedChanges) {
        const task = await Task.findById(change.taskId);
        if (!task) continue;

        if (change.action === 'defer_to_schedule') {
          task.isUrgent = false; 
          task.isImportant = true; // Protects its importance
          task.matrixQuadrant = 'Schedule';
          task.quadrant = 'Schedule';
          // Shift target date forward 24 hours
          if (!task.scheduleConstraint) task.scheduleConstraint = {};
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          task.scheduleConstraint.targetDate = tomorrow;
        } 
        else if (change.action === 'downgrade_to_shallow') {
          task.isUrgent = true; 
          task.isImportant = false; // Downgrades importance
          task.matrixQuadrant = 'Delegate'; // Maps to Q3 (Shallow Work)
          task.quadrant = 'Delegate';
          // Target date remains today, as it is shallow work
        }
        else if (change.action === 'promote') {
          task.isUrgent = true;
          task.isImportant = true;
          task.matrixQuadrant = 'Do_First';
          task.quadrant = 'Do';
        }

        await task.save();
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
