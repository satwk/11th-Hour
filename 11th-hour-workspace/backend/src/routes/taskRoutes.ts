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
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Low', 'Medium', 'High'],
      description: 'Cognitive load level needed for the task.'
    },
    estimatedDuration: {
      type: SchemaType.INTEGER,
      description: 'Estimated duration in minutes (e.g. 15, 30, 45, 60, etc.).'
    },
    externallyDependent: {
      type: SchemaType.BOOLEAN,
      description: 'True if the task involves waiting on someone else, delegation, or joint scheduling.'
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
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      return;
    }

    // Initialize Gemini AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are a highly efficient productivity assistant. Your task is to analyze the user's raw, unstructured "brain dump" text, identify all distinct tasks/actions mentioned, and categorize each task according to:
1. Eisenhower Quadrant:
   - 'Do': Urgent & Important (immediate action, high stakes)
   - 'Schedule': Important, Not Urgent (long-term value, no immediate deadline)
   - 'Delegate': Urgent, Not Important (needs fast completion, can/should be done by someone else or requires waiting/dependency)
   - 'Delete': Not Urgent, Not Important (low value, distraction, clutter)
2. Cognitive Load:
   - 'Low': Quick/routine task needing minimal focus (e.g. email reply, quick call)
   - 'Medium': Moderate focus/effort (e.g. drafting document, prep work)
   - 'High': Deep focus, intense problem solving (e.g. coding complex logic, deep research)
3. Estimated Duration: Integer representing minutes.
4. Externally Dependent: Boolean. Set to true if the task involves waiting on someone else, delegation, or joint scheduling.
5. Title: Active, short, action-oriented title (e.g. "Email Sarah about slides", not "Sarah email feedback").`,
    });

    const prompt = `Here is my brain dump: "${rawText}". Extract and structure all the tasks described.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const responseText = result.response.text();
    const parsedTasks = JSON.parse(responseText);

    if (!Array.isArray(parsedTasks)) {
      throw new Error('Gemini did not return an array of tasks.');
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
