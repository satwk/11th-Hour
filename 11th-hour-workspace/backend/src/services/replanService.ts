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
      enum: ['Task Reslotted', 'Urgency Downgraded', 'Draft ready'],
      description: 'The type of AI recommendation: Task Reslotted (slot/time change), Urgency Downgraded (quadrant downgrade), Draft ready (delegation draft).'
    },
    reason: {
      type: SchemaType.STRING,
      description: 'Clear, user-friendly reasoning of why this task is being adjusted, referencing the low energy/readiness score.'
    },
    proposedSlot: {
      type: SchemaType.STRING,
      description: 'Optional. Propose a new slot or quadrant (e.g. "Tomorrow morning", "Quadrant: Schedule").'
    },
    draftMessage: {
      type: SchemaType.STRING,
      description: 'Optional. If action is "Draft ready", write a polite message to delegate this task to a colleague.'
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

  // 3. Check if score is healthy (60 or above)
  if (score >= 60) {
    return {
      success: true,
      message: `Readiness score is healthy (${score}/100). No daily replanning changes required.`,
      score,
      changes: []
    };
  }

  // 4. Score is < 60: Find open tasks
  const openTasks = await Task.find({
    userId: user._id,
    status: { $ne: 'Completed' }
  });

  // Filter tasks with high cognitive load (score 4 or 5)
  const highLoadTasks = openTasks.filter(t => t.cognitiveLoad >= 4);

  if (highLoadTasks.length === 0) {
    return {
      success: true,
      message: `Readiness score is low (${score}/100), but user has no open "High" cognitive load tasks to replan.`,
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
    systemInstruction: `You are an automated productivity agent. The user is experiencing low readiness today.
Your job is to review the list of open "High" cognitive load tasks and recommend adjustments for ALL of them to reduce mental strain.
Adjustments can be:
- 'Task Reslotted': Push the task to a future slot (e.g. tomorrow, next week).
- 'Urgency Downgraded': Demote the task from 'Do' to 'Schedule' (since it can wait) or 'Schedule' to 'Delegate'.
- 'Draft ready': Propose to delegate the task and write a draft message they can copy-paste to send to a colleague.

Provide custom, helpful reasoning for each adjustment, referencing directly the user's low energy state.
Format the output as a JSON array matching the provided schema.`
  });

  const tasksListStr = highLoadTasks.map(t => (
    `ID: ${t._id}\nTitle: "${t.title}"\nQuadrant: ${t.quadrant}\nCognitive Load: ${t.cognitiveLoad}\nDuration: ${t.estimatedDuration}m\nExternally Dependent: ${t.externallyDependent}`
  )).join('\n\n');

  const prompt = `User Readiness Score: ${score}/100 (LOW energy/sleep).
Here are the open High cognitive load tasks:
${tasksListStr}

Propose adjustments to reschedule, downgrade, or delegate these tasks to lower the cognitive load for today.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: replanResponseSchema,
    },
  });

  const responseText = result.response.text();
  const parsedChanges = JSON.parse(responseText);

  if (!Array.isArray(parsedChanges)) {
    throw new Error('Gemini did not return a valid array of changes.');
  }

  // 6. Map and save PlanRevision document (with validation of task existence)
  const planRevisionChanges = [];
  for (const c of parsedChanges) {
    const matchingTask = highLoadTasks.find(t => t._id.toString() === c.taskId);
    if (matchingTask) {
      planRevisionChanges.push({
        taskId: matchingTask._id,
        action: c.action as 'Task Reslotted' | 'Urgency Downgraded' | 'Draft ready',
        reason: c.reason,
        proposedSlot: c.proposedSlot,
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
    triggerType: 'daily-replan',
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
