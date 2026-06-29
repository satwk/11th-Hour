import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI, SchemaType, Schema as GenAISchema } from '@google/generative-ai';
import { User } from '../models/User';
import { Task } from '../models/Task';

const router = Router();

// Define schema for Structured Outputs with Gemini
const taskSchema: GenAISchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: 'Active, concise, action-oriented title of the task (e.g. "Email Sarah about slides", not "Sarah email feedback").'
    },
    quadrant: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Do', 'Schedule', 'Delegate', 'Delete'],
      description: 'Eisenhower quadrant classification: Do (Urgent & Important), Schedule (Important, Not Urgent), Delegate (Urgent, Not Important), Delete (Not Urgent & Not Important).'
    },
    cognitiveLoad: {
      type: SchemaType.INTEGER,
      description: 'Cognitive load level needed for the task, numerically rated from 1 (very low focus/routine errand) to 5 (intense deep focus/high concentration).'
    },
    estimatedDuration: {
      type: SchemaType.INTEGER,
      description: 'Estimated duration in minutes (e.g. 15, 30, 45, 60, etc.).'
    },
    externallyDependent: {
      type: SchemaType.BOOLEAN,
      description: 'True if the task involves waiting on someone else, delegation, joint scheduling, or external human communication/blockers (e.g., "email professor", "call landlord", "wait for feedback").'
    },
    isUrgent: {
      type: SchemaType.BOOLEAN,
      description: 'True if the task has an imminent deadline (e.g., "today", "tonight", "ASAP") or blocks another immediate action. Otherwise, false.'
    },
    isImportant: {
      type: SchemaType.BOOLEAN,
      description: 'True if the task aligns with core goals, career, academics (e.g., "Exams", "Projects"), or health. If it is a basic chore, errand, or favor for someone else, it is false.'
    },
    scheduleConstraint: {
      type: SchemaType.OBJECT,
      nullable: true,
      description: 'Optional schedule constraint details. If the user specifies a day or time (e.g., next Tuesday evening), calculate the exact ISO date for targetDate and categorize timeOfDay. If no time is specified, leave it null.',
      properties: {
        targetDate: {
          type: SchemaType.STRING,
          nullable: true,
          description: 'The exact calculated date in YYYY-MM-DD format based on today\'s date and relative mentions (e.g. "this Sunday", "next week", "tomorrow"). If a day/date is not mentioned, this must be null.'
        },
        timeOfDay: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['morning', 'afternoon', 'evening', 'any'],
          description: 'General time of day constraint: "morning", "afternoon", "evening", or "any" if not specified.'
        },
        exactStartTime: {
          type: SchemaType.STRING,
          nullable: true,
          description: 'Calculated exact ISO timestamp (e.g. 2026-06-29T21:30:00.000Z) if the user explicitly states an exact start time (e.g. "at 9:30 PM", "tomorrow at 2 PM"). Leave null if not specified.'
        },
        durationOverride: {
          type: SchemaType.INTEGER,
          nullable: true,
          description: 'Calculated total duration in minutes if the user explicitly specifies a time range or duration (e.g. "6-9 PM", "for 2 hours"). Leave null if not specified.'
        }
      },
      required: ['timeOfDay']
    }
  },
  required: ['title', 'quadrant', 'cognitiveLoad', 'estimatedDuration', 'externallyDependent', 'scheduleConstraint', 'isUrgent', 'isImportant']
};

const responseSchema: GenAISchema = {
  type: SchemaType.ARRAY,
  description: 'List of structured tasks parsed from the brain dump.',
  items: taskSchema
};

router.post('/brain-dump', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, userId, firebaseId } = req.body;

    if (!rawText) {
      res.status(400).json({ error: 'rawText is required' });
      return;
    }

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId is required' });
      return;
    }

    // Resolve user in the database
    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        // If not a valid ObjectId, we will search by firebaseId or ignore
      }
    }

    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId });
    }

    // For testing and ease of onboarding, if user doesn't exist, we will create a default user
    if (!user) {
      console.log(`User not found for userId: ${userId} or firebaseId: ${firebaseId}. Creating a default user for testing...`);
      user = await User.create({
        firebaseId: firebaseId || `test-fb-${Date.now()}`,
        email: 'testuser@example.com',
        calendarSyncEnabled: false
      });
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      console.error("Missing Gemini API Key during request lifecycle");
      res.status(500).json({ error: "Failed to parse brain dump. Please try again." });
      return;
    }

    console.log('--- DIAGNOSTIC: Active Gemini Key Length:', apiKey.length, 'Ends with:', apiKey.slice(-4));

    const currentDateTime = new Date().toISOString();

    // Initialize Gemini AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: `The current system date and time is: ${currentDateTime}. Use this as your absolute anchor to calculate any relative dates (like "Sunday" or "tomorrow") into strict ISO format for the targetDate field. You are a highly efficient productivity assistant. Your task is to analyze the user's raw, unstructured "brain dump" text, identify all distinct tasks/actions mentioned, and categorize each task according to:
1. Eisenhower Quadrant:
   - 'Do': Urgent & Important (immediate action, high stakes).
     CRITICAL RULE: Strictly classify routine daily chores, errands, and physical tasks (e.g., walking the dog, buying food, doing laundry, grocery shopping, washing dishes) as 'Schedule' or 'Delegate', NEVER 'Do' (Do First), unless the user explicitly uses words like 'Emergency', 'ASAP', or 'urgently'.
   - 'Schedule': Important, Not Urgent (long-term value, chores/errands that need doing but aren't emergencies).
   - 'Delegate': Urgent, Not Important (can/should be done by someone else, or requires waiting/dependency).
   - 'Delete': Not Urgent, Not Important (low value, distraction).
2. Cognitive Load (differentiate strictly):
   Evaluate the cognitive complexity of each parsed task numerically and assign it a cognitiveLoad score from 1 (very low focus/routine errand) to 5 (high deep focus/intense concentration).
3. Estimated Duration: Integer representing minutes.
4. Externally Dependent: Boolean. Set to true if the task involves waiting on someone else, delegation, joint scheduling, or external human communication/blockers (e.g., "email professor", "call landlord", "wait for response").
5. Schedule Constraint: If the user specifies a day or time (e.g., next Tuesday evening), use the provided currentDateTime anchor to calculate the exact ISO date for targetDate and categorize timeOfDay. If no time is specified, leave it null.
   - If the user explicitly states an exact time (e.g., 'at 9:30 PM' or 'tomorrow at 2 PM'), calculate the exact ISO timestamp using the provided currentDateTime anchor and output it as exactStartTime. You MUST generate the exactStartTime ISO string in the user's local timezone (IST, Asia/Kolkata). Do not output a trailing 'Z' (UTC). Instead, append the explicit IST offset '+05:30'. For example, 4:00 PM on June 29th should be output as '2026-06-29T16:00:00.000+05:30'. If they specify a time range (e.g., '6-9 PM' or 'for 2 hours'), calculate the total minutes and output it as durationOverride. If neither is specified, leave them null.
6. Title: Active, short, action-oriented title (e.g. "Email Sarah about slides", not "Sarah email feedback").
7. Urgency (isUrgent): If the task has an imminent deadline (e.g., 'today', 'tonight', 'ASAP') or blocks another immediate action, it is true. If the task specifies a future scheduled time or date (e.g., 'tomorrow from 4-6 PM' or 'next Tuesday'), it is mathematically NOT urgent right now. You MUST set isUrgent: false. Otherwise, false.
8. Importance (isImportant): If the task aligns with core goals, career, academics (e.g., 'Exams', 'Projects'), or health, it is true. If it is a basic chore, errand, or favor for someone else, it is false.`,
    });

    const prompt = `Here is my brain dump: "${rawText}". Extract and structure all the tasks described.`;

    let parsedTasks: any[] = [];
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const responseText = result.response.text();
      parsedTasks = JSON.parse(responseText);

      if (!Array.isArray(parsedTasks)) {
        throw new Error('Gemini did not return an array of tasks.');
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to parse brain dump. Please try again." });
      return;
    }

    // Save parsed tasks to MongoDB under the user's _id
    const savedTasks = await Promise.all(
      parsedTasks.map(async (t: any) => {
        // Strict 2x2 Auto-Routing Block
        let resolvedMatrixQuadrant: 'Do_First' | 'Schedule' | 'Delegate' | 'Eliminate' = 'Eliminate';
        let resolvedQuadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete' = 'Delete';

        let urgent = !!t.isUrgent;
        let important = !!t.isImportant;

        // OVERRIDE: If the task has an exact scheduled time, it inherently belongs in the Schedule quadrant.
        if (t.scheduleConstraint && t.scheduleConstraint.exactStartTime) {
          urgent = false; // Force the flag to match the matrix reality
          important = true;
          resolvedMatrixQuadrant = 'Schedule';
          resolvedQuadrant = 'Schedule';
        } else {
          if (urgent && important) {
            resolvedMatrixQuadrant = 'Do_First';
            resolvedQuadrant = 'Do';
          } else if (!urgent && important) {
            resolvedMatrixQuadrant = 'Schedule';
            resolvedQuadrant = 'Schedule';
          } else if (urgent && !important) {
            resolvedMatrixQuadrant = 'Delegate';
            resolvedQuadrant = 'Delegate';
          } else {
            resolvedMatrixQuadrant = 'Eliminate';
            resolvedQuadrant = 'Delete';
          }
        }

        const newTask = new Task({
          userId: user._id,
          title: t.title,
          quadrant: resolvedQuadrant,
          matrixQuadrant: resolvedMatrixQuadrant,
          isUrgent: urgent,
          isImportant: important,
          cognitiveLoad: t.cognitiveLoad,
          estimatedDuration: t.estimatedDuration,
          status: 'Not Started',
          externallyDependent: t.externallyDependent,
          scheduleConstraint: t.scheduleConstraint ? {
            targetDate: t.scheduleConstraint.targetDate ? new Date(t.scheduleConstraint.targetDate) : undefined,
            timeOfDay: t.scheduleConstraint.timeOfDay || 'any',
            exactStartTime: t.scheduleConstraint.exactStartTime ? new Date(t.scheduleConstraint.exactStartTime) : undefined,
            durationOverride: t.scheduleConstraint.durationOverride != null ? Number(t.scheduleConstraint.durationOverride) : undefined
          } : undefined
        });
        return await newTask.save();
      })
    );

    res.status(201).json({
      message: 'Brain dump parsed and tasks created successfully.',
      tasks: savedTasks
    });

  } catch (error: any) {
    console.error('Error in /api/tasks/brain-dump:', error);
    res.status(500).json({
      error: 'Failed to process brain dump.',
      details: error.message || error
    });
  }
});

// POST /api/tasks - Manually create a task with auto-routing
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      firebaseId,
      title,
      isUrgent,
      isImportant,
      cognitiveLoad,
      estimatedDuration,
      externallyDependent,
      scheduleConstraint
    } = req.body;

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId is required' });
      return;
    }

    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) { }
    }
    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId });
    }
    if (!user) {
      user = await User.create({
        firebaseId: firebaseId || `test-fb-${Date.now()}`,
        email: 'testuser@example.com',
        calendarSyncEnabled: false
      });
    }

    // Strict 2x2 Auto-Routing Block
    let resolvedMatrixQuadrant: 'Do_First' | 'Schedule' | 'Delegate' | 'Eliminate' = 'Eliminate';
    let resolvedQuadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete' = 'Delete';

    let urgent = !!isUrgent;
    let important = !!isImportant;

    // OVERRIDE: If the task has an exact scheduled time, it inherently belongs in the Schedule quadrant.
    if (scheduleConstraint && scheduleConstraint.exactStartTime) {
      urgent = false; // Force the flag to match the matrix reality
      important = true;
      resolvedMatrixQuadrant = 'Schedule';
      resolvedQuadrant = 'Schedule';
    } else {
      if (urgent && important) {
        resolvedMatrixQuadrant = 'Do_First';
        resolvedQuadrant = 'Do';
      } else if (!urgent && important) {
        resolvedMatrixQuadrant = 'Schedule';
        resolvedQuadrant = 'Schedule';
      } else if (urgent && !important) {
        resolvedMatrixQuadrant = 'Delegate';
        resolvedQuadrant = 'Delegate';
      } else {
        resolvedMatrixQuadrant = 'Eliminate';
        resolvedQuadrant = 'Delete';
      }
    }

    const newTask = new Task({
      userId: user._id,
      title: title || 'Untitled Task',
      quadrant: resolvedQuadrant,
      matrixQuadrant: resolvedMatrixQuadrant,
      isUrgent: urgent,
      isImportant: important,
      cognitiveLoad: cognitiveLoad || 1,
      estimatedDuration: estimatedDuration || 30,
      status: 'Not Started',
      externallyDependent: !!externallyDependent,
      scheduleConstraint: scheduleConstraint ? {
        targetDate: scheduleConstraint.targetDate ? new Date(scheduleConstraint.targetDate) : undefined,
        timeOfDay: scheduleConstraint.timeOfDay || 'any',
        exactStartTime: scheduleConstraint.exactStartTime ? new Date(scheduleConstraint.exactStartTime) : undefined,
        durationOverride: scheduleConstraint.durationOverride != null ? Number(scheduleConstraint.durationOverride) : undefined
      } : undefined
    });

    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (error: any) {
    console.error('Error creating task manually:', error);
    res.status(500).json({ error: 'Failed to create task.', details: error.message || error });
  }
});

// GET /api/tasks - Retrieve all tasks for a user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, firebaseId } = req.query;

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId query parameter is required' });
      return;
    }

    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) { }
    }

    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId: firebaseId as string });
    }

    if (!user) {
      // If user does not exist, return an empty array for initial setup/onboarding
      res.status(200).json([]);
      return;
    }

    const tasks = await Task.find({ userId: (user as any)._id }).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

// PATCH /api/tasks/:id - Update specific task fields (e.g. quadrant, status)
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Synchronize matrixQuadrant, isUrgent, and isImportant when quadrant is updated
    if (updates.quadrant) {
      if (updates.quadrant === 'Do') {
        updates.matrixQuadrant = 'Do_First';
        updates.isUrgent = true;
        updates.isImportant = true;
      } else if (updates.quadrant === 'Schedule') {
        updates.matrixQuadrant = 'Schedule';
        updates.isUrgent = false;
        updates.isImportant = true;
      } else if (updates.quadrant === 'Delegate') {
        updates.matrixQuadrant = 'Delegate';
        updates.isUrgent = true;
        updates.isImportant = false;
      } else if (updates.quadrant === 'Delete') {
        updates.matrixQuadrant = 'Eliminate';
        updates.isUrgent = false;
        updates.isImportant = false;
      }
    }

    // Bidirectional sync: if isUrgent or isImportant are directly modified
    if (updates.isUrgent !== undefined || updates.isImportant !== undefined) {
      const currentTask = await Task.findById(id);
      if (currentTask) {
        const urgent = updates.isUrgent !== undefined ? updates.isUrgent : currentTask.isUrgent;
        const important = updates.isImportant !== undefined ? updates.isImportant : currentTask.isImportant;
        if (urgent && important) {
          updates.matrixQuadrant = 'Do_First';
          updates.quadrant = 'Do';
        } else if (!urgent && important) {
          updates.matrixQuadrant = 'Schedule';
          updates.quadrant = 'Schedule';
        } else if (urgent && !important) {
          updates.matrixQuadrant = 'Delegate';
          updates.quadrant = 'Delegate';
        } else {
          updates.matrixQuadrant = 'Eliminate';
          updates.quadrant = 'Delete';
        }
      }
    }

    const task = await Task.findByIdAndUpdate(id, updates, { new: true });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(200).json({
      message: 'Task updated successfully',
      task
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
});

// PATCH /api/tasks/:id/complete - Complete a task
router.patch('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndUpdate(id, {
      status: 'Completed',
      isCompleted: true
    }, { new: true });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(200).json({
      message: 'Task completed successfully',
      task
    });
  } catch (error: any) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task', details: error.message || error });
  }
});

export default router;
