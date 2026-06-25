import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType, Schema as GenAISchema } from '@google/generative-ai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your-gemini-api-key-here') {
  console.error('Error: GEMINI_API_KEY is not configured in .env file.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const taskSchema: GenAISchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: 'Active, concise, action-oriented title of the task.'
    },
    quadrant: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Do', 'Schedule', 'Delegate', 'Delete'],
      description: 'Eisenhower quadrant classification.'
    },
    cognitiveLoad: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Low', 'Medium', 'High'],
      description: 'Cognitive load level needed for the task.'
    },
    estimatedDuration: {
      type: SchemaType.INTEGER,
      description: 'Estimated duration in minutes.'
    },
    externallyDependent: {
      type: SchemaType.BOOLEAN,
      description: 'True if the task involves waiting on someone else or delegation.'
    }
  },
  required: ['title', 'quadrant', 'cognitiveLoad', 'estimatedDuration', 'externallyDependent']
};

const responseSchema: GenAISchema = {
  type: SchemaType.ARRAY,
  description: 'List of structured tasks parsed from the brain dump.',
  items: taskSchema
};

const runTest = async () => {
  try {
    console.log('Sending test brain-dump to Gemini 1.5 Flash...');
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: 'You are a task categorizer that parses unstructured text dumps into a clean task schema.'
    });

    const rawText = 'I need to review the code with Bob by 3pm today. Also, must buy groceries for dinner. I should probably plan the vacation itinerary sometime this weekend. Let me cancel that old subscription I do not use.';
    console.log(`Input Text: "${rawText}"\n`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Parse this brain dump: "${rawText}"` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    console.log('--- Response from Gemini ---');
    console.log(result.response.text());
    console.log('-----------------------------');
    console.log('Test successful! Gemini is correctly mapping the unstructured text.');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
};

runTest();
