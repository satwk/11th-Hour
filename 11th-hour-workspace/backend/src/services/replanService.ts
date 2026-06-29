import { Types } from 'mongoose';
import { GoogleGenerativeAI, SchemaType, Schema as GenAISchema } from '@google/generative-ai';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { ReadinessLog } from '../models/ReadinessLog';
import { PlanRevision } from '../models/PlanRevision';

// Calculate readiness score (0-100)
// energyLevel: 1-5 (contributes up to 50 pts)
// sleepHours: hours (contributes up to 40 pts, capped at 8h target)
// dailyWinsCount: wins count (contributes up to 10 pts, capped at 5 wins)
export const calculateReadinessScore = (energyLevel: number, sleepHours: number, dailyWinsCount: number): number => {
  const energyScore = (energyLevel / 5) * 50;
  const sleepScore = Math.min(sleepHours / 8, 1) * 40;
  const winsScore = Math.min(dailyWinsCount / 5, 1) * 10;
  return Math.round(energyScore + sleepScore + winsScore);
};

// Replan schema for Gemini structured output
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
      description: 'The type of AI recommendation: defer_to_schedule (move to Q2), downgrade_to_shallow (move to Q3), or promote (move to Q1).'
    },
    reason: {
      type: SchemaType.STRING,
      description: 'Clear, user-friendly reasoning of why this task is being adjusted, referencing the low energy/readiness score.'
    },
    proposedSlot: {
      type: SchemaType.OBJECT,
      properties: {
        start: {
          type: SchemaType.STRING,
          description: 'Proposed start time in YYYY-MM-DDTHH:mm:ssZ format (e.g., 2026-06-29T09:00:00Z).'
        },
        end: {
          type: SchemaType.STRING,
          description: 'Proposed end time in YYYY-MM-DDTHH:mm:ssZ format (e.g., 2026-06-29T10:00:00Z).'
        }
      },
      description: 'Optional proposed start/end slot if action is reslot.'
    },
    draftMessage: {
      type: SchemaType.STRING,
      description: 'Optional. If action is "draft-message", write a polite message to delegate this task to a colleague.'
    }
  },
  required: ['taskId', 'action', 'reason']
};

const replanResponseSchema: GenAISchema = {
  type: SchemaType.ARRAY,
  description: 'Array of proposed adjustments for the tasks.',
  items: planChangeSchema
};

export const runDailyReplan = async (
  userId: Types.ObjectId | string,
  energyStats?: { energyLevel: number; sleepHours: number; dailyWinsCount: number }
) => {
  // Find User
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  let readinessLog = null;

  // 1. If energyStats are provided, create a new ReadinessLog
  if (energyStats) {
    const score = calculateReadinessScore(
      energyStats.energyLevel,
      energyStats.sleepHours,
      energyStats.dailyWinsCount
    );

    readinessLog = new ReadinessLog({
      userId: user._id,
      energyLevel: energyStats.energyLevel,
      sleepHours: energyStats.sleepHours,
      dailyWinsCount: energyStats.dailyWinsCount,
      calculatedScore: score
    });
    await readinessLog.save();
    console.log(`Saved new ReadinessLog. Score: ${score}`);
  } else {
    // 2. Otherwise find the latest ReadinessLog entry for this user
    readinessLog = await ReadinessLog.findOne({ userId: user._id }).sort({ createdAt: -1 });
  }

  if (!readinessLog) {
    return {
      success: false,
      message: 'No readiness log found for the user. Please log daily readiness metrics first.'
    };
  }

  const score = readinessLog.calculatedScore;
  console.log(`Evaluating user ${user.email} with readiness score ${score}`);

  // 4. Find active Q1 tasks
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
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const promotableTasks = await Task.find({
    userId: user._id,
    isCompleted: false,
    $or: [
      { matrixQuadrant: 'Schedule', 'scheduleConstraint.targetDate': { $lte: endOfToday } },
      { matrixQuadrant: 'Delegate' } // Q3 tasks
    ]
  });

  const isSurplusMode = score >= 60 && currentLoad < dailyLimit;
  const isOverloadMode = score < 60 || currentLoad > dailyLimit;
  const needsReplan = isOverloadMode || (isSurplusMode && promotableTasks.length > 0);

  if (!needsReplan) {
    return {
      success: true,
      message: `Readiness score is healthy (${score}/100) and Q1 load is balanced. No daily replanning changes required.`,
      score,
      changes: []
    };
  }

  // 5. Call Gemini to replan
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    systemInstruction: `You are an automated productivity agent. The user is experiencing low readiness today or has a capacity surplus.
Your job is to review the list of open tasks and recommend adjustments to reduce mental strain or promote items when bandwidth allows.
The current system date and time is: ${new Date().toISOString()}. Use this as your absolute anchor to calculate any relative dates (like "tomorrow") into strict YYYY-MM-DDTHH:mm:ssZ format for proposedSlot.start and proposedSlot.end (e.g., "2026-06-29T09:00:00Z"). Do not repeat or loop time tokens.

CRITICAL INSTRUCTION: You are evaluating the 'Do First' (Urgent & Important) queue. If the currentLoad exceeds the dailyLimit, you MUST propose defer/downgrade/promote actions to bring the load under the limit, regardless of how important or urgent they are. The user lacks the physical capacity to complete them today. Do not hesitate to defer high-priority tasks to tomorrow.

When proposing to remove a task from the 'Do First' (Q1) queue due to overload, you must evaluate its gravity:
- If it is a critical core objective or heavy project (e.g., major exam prep), use action 'defer_to_schedule' (to postpone it to tomorrow).
- If it is lighter practice, reading, or 'fluff' (e.g., 'Read a chapter', 'Solve 2 problems'), use action 'downgrade_to_shallow' to move it to the user's Shallow Work (Q3) quadrant so they can clear it out with low energy today.

If currentLoad < dailyLimit, you are in 'Surplus Mode'. The user has spare cognitive bandwidth today.
Look at the provided promotableTasks. You must propose the promote action to move tasks from the bench into the 'Do First' queue, up to the remaining capacity (dailyLimit - currentLoad).
Prioritize Q2 tasks that are due today. If there is still space, promote Q3 tasks to clear them out.
Provide an encouraging 1-sentence reason (e.g., 'Since your readiness is high, you have the bandwidth to tackle this scheduled exam prep today.').

Format the output as a JSON array matching the provided schema.`
  });

  const payload = {
    readinessScore: score,
    currentLoad,
    dailyLimit,
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

Analyze the tasks against the readiness score, and output the required PlanRevision modifications as a JSON array.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: replanResponseSchema,
    },
  });

  const responseText = result.response.text();
  let parsedChanges;
  try {
    parsedChanges = JSON.parse(responseText);
  } catch (err: any) {
    console.error(`Error: Failed to parse Gemini response of length ${responseText.length}.`);
    console.error("Response preview:", responseText.slice(0, 1000));
    throw err;
  }

  if (!Array.isArray(parsedChanges)) {
    throw new Error('Gemini did not return a valid array of changes.');
  }

  // 6. Map and save PlanRevision document (with validation of task existence)
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
        action: c.action as 'reslot' | 'rechunk' | 'downgrade' | 'draft-message' | 'requeue',
        reason: c.reason,
        proposedSlot,
        draftMessage: c.draftMessage
      });
    }
  }

  if (planRevisionChanges.length === 0) {
    return {
      success: true,
      message: `Readiness score is low (${score}/100), but no valid task adjustments were proposed.`,
      score,
      changes: []
    };
  }

  const planRevision = new PlanRevision({
    userId: user._id,
    triggerType: 'scheduled',
    changes: planRevisionChanges,
    userConfirmed: false
  });

  await planRevision.save();

  return {
    success: true,
    message: `Readiness score is low (${score}/100). Proposing adjustments for ${planRevisionChanges.length} High cognitive load task(s).`,
    score,
    planRevision
  };
};
