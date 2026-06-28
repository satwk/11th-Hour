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
    scheduleConstraint: {
      type: SchemaType.OBJECT,
      properties: {
        targetDate: {
          type: SchemaType.STRING,
          description: 'The exact calculated date in YYYY-MM-DD format based on today\'s date and relative mentions (e.g. "this Sunday", "next week", "tomorrow"). If a day/date is not mentioned, this must be null.'
        },
        timeOfDay: {
          type: SchemaType.STRING,
          description: 'General time of day constraint: "morning", "afternoon", "evening", or "any" if not specified.'
        }
      },
      description: 'Optional schedule constraint details. Set to null or omit if no date/time constraint is specified.'
    }
  },
  required: ['title', 'quadrant', 'cognitiveLoad', 'estimatedDuration', 'externallyDependent']
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

    const currentDateTime = new Date().toLocaleString();

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
5. Schedule Constraint: If the user mentions a day (e.g., 'this Sunday', 'next week', 'tomorrow'), calculate the exact future date (YYYY-MM-DD) based on today's date.
   - Put this calculated ISO string in scheduleConstraint.targetDate.
   - For relative dates:
     - 'tomorrow' is today + 1 day.
     - 'this Sunday' is the upcoming Sunday.
     - 'next week' is typically 7 days from today (or the start of the next week, e.g., next Monday). Be logical.
     - If no specific date/day is mentioned, targetDate should be null.
   - Extract any time of day constraint ('morning', 'afternoon', 'evening', 'any') and place it in scheduleConstraint.timeOfDay. Default to 'any' if none is mentioned.
6. Title: Active, short, action-oriented title (e.g. "Email Sarah about slides", not "Sarah email feedback").`,
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
        const newTask = new Task({
          userId: user._id,
          title: t.title,
          quadrant: t.quadrant,
          cognitiveLoad: t.cognitiveLoad,
          estimatedDuration: t.estimatedDuration,
          status: 'Not Started',
          externallyDependent: t.externallyDependent,
          scheduleConstraint: t.scheduleConstraint || undefined
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
      } catch (err) {}
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

export default router;
