import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { User } from '../models/User';
import { Task } from '../models/Task';

const router = Router();

export const getOAuthClient = (user: any) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  });

  // Automatically listen to token refresh events and save updated keys to user document
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      user.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }
      await user.save();
      console.log('Google access token refreshed and saved successfully.');
    }
  });

  return oauth2Client;
};

const getUTCForLocalTime = (dateStr: string, timeStr: string, tz: string): Date => {
  const baseUTC = new Date(`${dateStr}T${timeStr}Z`);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(baseUTC);
    const p: Record<string, string> = {};
    parts.forEach(part => { p[part.type] = part.value; });

    const formattedYear = Number(p.year);
    const formattedMonth = Number(p.month);
    const formattedDay = Number(p.day);
    const formattedHour = Number(p.hour);
    const formattedMinute = Number(p.minute);
    const formattedSecond = Number(p.second);

    const dateParts = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);

    const targetYear = dateParts[0] || 2026;
    const targetMonth = dateParts[1] || 1;
    const targetDay = dateParts[2] || 1;

    const targetHour = timeParts[0] || 0;
    const targetMinute = timeParts[1] || 0;
    const targetSecond = timeParts[2] || 0;

    const actualUTC = Date.UTC(formattedYear, formattedMonth - 1, formattedDay, formattedHour, formattedMinute, formattedSecond);
    const expectedUTC = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute, targetSecond);

    const diff = expectedUTC - actualUTC;
    return new Date(baseUTC.getTime() + diff);
  } catch (err) {
    console.warn(`Timezone calculation failed for ${dateStr} ${timeStr} in ${tz}, falling back to local time.`, err);
    return new Date(`${dateStr}T${timeStr}`);
  }
};

// Endpoint to connect Google OAuth credentials
router.post('/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firebaseId, googleAccessToken } = req.body;

    if (!firebaseId || !googleAccessToken) {
      res.status(400).json({ error: 'firebaseId and googleAccessToken are required.' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { firebaseId },
      { googleAccessToken, calendarSyncEnabled: true },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: 'Google Calendar successfully connected.',
      user
    });
  } catch (error: any) {
    console.error('Error connecting calendar:', error);
    res.status(500).json({ error: 'Failed to connect Google Calendar.', details: error.message });
  }
});

// Endpoint to disconnect Google Calendar
router.post('/disconnect', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firebaseId } = req.body;

    if (!firebaseId) {
      res.status(400).json({ error: 'firebaseId is required.' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { firebaseId },
      { googleAccessToken: undefined, googleRefreshToken: undefined, calendarSyncEnabled: false },
      { new: true }
    );

    res.status(200).json({
      message: 'Google Calendar successfully disconnected.',
      user
    });
  } catch (error: any) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar.', details: error.message });
  }
});

// Endpoint to fetch Free/Busy schedule for next 3 days
router.get('/free-busy', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firebaseId } = req.query;

    if (!firebaseId) {
      res.status(400).json({ error: 'firebaseId is required.' });
      return;
    }

    const user = await User.findOne({ firebaseId: firebaseId as string });
    if (!user || !user.googleAccessToken) {
      res.status(400).json({ error: 'Google Calendar is not connected for this user.' });
      return;
    }

    const oauth2Client = getOAuthClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const fbResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: threeDaysLater.toISOString(),
        items: [{ id: 'primary' }]
      }
    });

    res.status(200).json({
      success: true,
      timeMin: now.toISOString(),
      timeMax: threeDaysLater.toISOString(),
      freeBusy: fbResponse.data.calendars?.primary || { busy: [] }
    });
  } catch (error: any) {
    console.error('Error fetching free/busy schedule:', error);
    res.status(500).json({ error: 'Failed to read user calendar schedule.', details: error.message });
  }
});

// POST /api/calendar/schedule - AI-chunk and schedule event in first available free busy gap
router.post('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firebaseId, taskId } = req.body;

    if (!firebaseId || !taskId) {
      res.status(400).json({ error: 'firebaseId and taskId are required.' });
      return;
    }

    const user = await User.findOne({ firebaseId });
    if (!user || !user.googleAccessToken) {
      res.status(400).json({ error: 'Google Calendar is not connected.' });
      return;
    }

    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    console.log('Syncing Task Target Date:', task.scheduleConstraint?.targetDate);
    console.log('Syncing Task Exact Start Time:', task.scheduleConstraint?.exactStartTime);

    const oauth2Client = getOAuthClient(user);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch primary calendar timezone
    let timezone = 'UTC';
    try {
      const calInfo = await calendar.calendars.get({ calendarId: 'primary' });
      timezone = calInfo.data.timeZone || 'UTC';
    } catch (err) {
      console.warn('Could not fetch calendar timezone, defaulting to UTC.', err);
    }

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const hasTargetDate = !!(task.scheduleConstraint && task.scheduleConstraint.targetDate);
    const targetDateVal = task.scheduleConstraint?.targetDate;
    const targetDateStr = targetDateVal instanceof Date
      ? targetDateVal.toISOString().split('T')[0]
      : targetDateVal;
    const timeOfDay = task.scheduleConstraint?.timeOfDay || 'any';

    let timeMinDate = now;
    let timeMaxDate = sevenDaysLater;

    if (hasTargetDate && targetDateStr) {
      timeMinDate = getUTCForLocalTime(targetDateStr, "00:00:00", timezone);
      timeMaxDate = getUTCForLocalTime(targetDateStr, "23:59:59", timezone);

      if (timeMinDate.getTime() < now.getTime()) {
        timeMinDate = now;
      }

      if (timeMinDate.getTime() >= timeMaxDate.getTime()) {
        res.status(400).json({ error: `Cannot schedule for target date ${targetDateStr}. The scheduling window for this date has already passed.` });
        return;
      }
    }

    let finalStart: string;
    let finalEnd: string;

    if (task.scheduleConstraint && task.scheduleConstraint.exactStartTime) {
      // STRUCT FIX: Absolute Time Bypass
      const startDateObj = new Date(task.scheduleConstraint.exactStartTime);
      
      // Past-Midnight Protection: If the target time has already passed today, assume the user meant the upcoming occurrence
      if (startDateObj < new Date()) {
        startDateObj.setDate(startDateObj.getDate() + 1);
      }
      
      finalStart = startDateObj.toISOString();
      
      const durationMinutes = task.scheduleConstraint.durationOverride || 60;
      finalEnd = new Date(startDateObj.getTime() + durationMinutes * 60000).toISOString();
      
      console.log('Bypassing freebusy. Forcing exact slot:', finalStart, 'to', finalEnd);
    } else {
      // Fallback only if no exact time exists
      console.log('No exact time found. Falling back to search loop...');

      // 1. Query free/busy schedule using calendar.freebusy.query
      const fbResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMinDate.toISOString(),
          timeMax: timeMaxDate.toISOString(),
          items: [{ id: 'primary' }]
        }
      });

      const busySlots = (fbResponse.data.calendars?.primary?.busy || [])
        .map((slot: any) => {
          const start = new Date(slot.start || '');
          const end = new Date(slot.end || '');
          return { start, end };
        })
        .filter((s) => !isNaN(s.start.getTime()) && !isNaN(s.end.getTime()))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // 2. Find first candidate gap matching constraints
      const durationMinutes = task.scheduleConstraint?.durationOverride != null
        ? task.scheduleConstraint.durationOverride
        : task.estimatedDuration;
      const durationMs = durationMinutes * 60 * 1000;
      
      // Set candidateTime to search start
      let candidateTime = new Date(timeMinDate.getTime());
      if (!hasTargetDate) {
        candidateTime = new Date(now.getTime() + 15 * 60 * 1000); // 15m from now for normal
      }
      
      // Round to next 15-minute interval
      candidateTime.setMinutes(Math.ceil(candidateTime.getMinutes() / 15) * 15, 0, 0);

      let foundSlot: { start: Date; end: Date } | null = null;
      const maxSearchTime = timeMaxDate.getTime();

      while (candidateTime.getTime() < maxSearchTime) {
        const candidateStart = new Date(candidateTime.getTime());
        const candidateEnd = new Date(candidateTime.getTime() + durationMs);

        // Check timezone-specific waking hours
        let isWakingHours = true;
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          });
          
          const startParts = formatter.formatToParts(candidateStart);
          const endParts = formatter.formatToParts(candidateEnd);
          
          const getHourAndMinute = (parts: Intl.DateTimeFormatPart[]) => {
            const p: Record<string, string> = {};
            parts.forEach(part => { p[part.type] = part.value; });
            return { hour: Number(p.hour), minute: Number(p.minute) };
          };

          const start = getHourAndMinute(startParts);
          const end = getHourAndMinute(endParts);
          
          const startDecimal = start.hour + start.minute / 60;
          const endDecimal = end.hour + end.minute / 60;

          if (timeOfDay === 'morning') {
            isWakingHours = startDecimal >= 8 && endDecimal <= 12;
          } else if (timeOfDay === 'afternoon') {
            isWakingHours = startDecimal >= 12 && endDecimal <= 17;
          } else if (timeOfDay === 'evening') {
            isWakingHours = startDecimal >= 17 && endDecimal <= 22;
          } else { // 'any' or default
            isWakingHours = startDecimal >= 8 && endDecimal <= 20;
          }
        } catch (err) {
          // Fallback using UTC hours
          const startHour = candidateStart.getUTCHours();
          const endHour = candidateEnd.getUTCHours();
          if (timeOfDay === 'morning') {
            isWakingHours = startHour >= 8 && endHour <= 12;
          } else if (timeOfDay === 'afternoon') {
            isWakingHours = startHour >= 12 && endHour <= 17;
          } else if (timeOfDay === 'evening') {
            isWakingHours = startHour >= 17 && endHour <= 22;
          } else {
            isWakingHours = startHour >= 8 && endHour <= 20;
          }
        }

        if (!isWakingHours) {
          candidateTime = new Date(candidateTime.getTime() + 15 * 60 * 1000);
          continue;
        }

        // Check overlap
        const overlappingEvent = busySlots.find(
          (slot) => candidateStart < slot.end && candidateEnd > slot.start
        );

        if (overlappingEvent) {
          candidateTime = new Date(overlappingEvent.end.getTime());
          candidateTime.setMinutes(Math.ceil(candidateTime.getMinutes() / 15) * 15, 0, 0);
        } else {
          foundSlot = { start: candidateStart, end: candidateEnd };
          break;
        }
      }

      if (!foundSlot) {
        const dateInfo = hasTargetDate ? `on target date ${targetDateStr}` : 'in the next 7 days';
        res.status(400).json({ error: `No available calendar slot found ${dateInfo} within the specified hours.` });
        return;
      }

      finalStart = foundSlot.start.toISOString();
      finalEnd = foundSlot.end.toISOString();
    }

    // 3. AI-generate micro-chunk task details using Gemini 2.0 Flash
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      console.error("Missing Gemini API Key during request lifecycle");
      res.status(500).json({ error: "Failed to generate micro-chunk task steps. Please try again." });
      return;
    }

    console.log('--- DIAGNOSTIC: Active Gemini Key Length:', apiKey.length, 'Ends with:', apiKey.slice(-4));

    let parsedAI = {
      microTitle: task.title,
      steps: ['Break down larger task into details', 'Execute focused sub-steps']
    };

    const currentDateTime = new Date().toLocaleString();

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: `The current system date and time is: ${currentDateTime}. Use this as your absolute anchor to calculate any relative dates (like "Sunday" or "tomorrow") into strict ISO format for the targetDate field. You are an expert productivity coach.
Your job is to take a user's task and create a highly actionable, focused "micro-chunk" title (up to 40 characters) representing a single-sitting deliverable.
Also write specific, actionable steps to list as instructions in the event description.

CRITICAL DIRECTIVE: You must strictly distinguish between 'Physical Errands' (e.g., going out to buy things, visits, physical checkups, picking up objects, walking a dog) and 'Desk Work' (writing, planning, coding).
- If it is a Physical Errand, the micro-chunk event title MUST reflect the physical action directly (e.g., 'Go to store for vegetables', 'Pick up keys from front desk', 'Drive to pharmacy'). Under NO circumstances should you name it a desk-work action like 'Create a list', 'Plan grocery list', or 'Plan visit'.
- If it is Desk Work, write a title indicating the focused deliverable.

STRICT ANTI-SLOP MICRO-STEPS RULE:
1. Zero Hallucination Rule: You are strictly forbidden from inventing specific sub-tasks, locations, or topics that were not explicitly stated in the user's raw input.
2. Semantic Differentiation: If the task is a social meeting, errand, or physical event, DO NOT generate micro-steps. Output a single, clean, generic description like 'Attend scheduled event' or 'Complete physical errand.'
3. Vague Actionability: If generating steps for general study or desk work (e.g., 'DSA prep'), keep the steps abstract and structural (e.g., 'Gather study materials', 'Complete practice problems', 'Review concepts') rather than guessing the exact academic topic.

If a task is a simple physical errand (e.g. 'Buy fish food', 'Walk dog') OR is estimated to take under 45 minutes:
- DO NOT generate generic corporate/management sub-steps or filler descriptions (such as 'Break down task', 'Plan details', or 'Execute steps').
- Instead, return a single, literal instruction (e.g., 'Drive to pet store and purchase fish food', 'Take dog for a walk around the block').
- If sub-steps are logical and necessary, keep them literal. If sub-steps are illogical or completely unnecessary, return an empty array [] for steps.

Return structured JSON output matching the requested schema.`
      });

      const prompt = `Original Task Title: "${task.title}"\nEstimated Duration: ${task.estimatedDuration}m\nCognitive Load: ${task.cognitiveLoad}\n\nOutput a micro-chunk title and steps in JSON.`;

      const aiResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              microTitle: { type: SchemaType.STRING, description: 'Short actionable title' },
              steps: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'A list of action steps. If the task is under 45 minutes or a physical errand, this should contain a single literal instruction or be empty [] if sub-steps are illogical.'
              }
            },
            required: ['microTitle', 'steps']
          }
        }
      });

      parsedAI = JSON.parse(aiResult.response.text());
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to generate micro-chunk task steps. Please try again." });
      return;
    }

    // 4. Write calendar event using calendar.events.insert
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `[11th Hour] ${parsedAI.microTitle}`,
        description: `Micro-steps to complete in this session:\n${parsedAI.steps.map((s: string) => `• ${s}`).join('\n')}\n\nScheduled automatically by 11th Hour.`,
        start: { dateTime: finalStart, timeZone: 'Asia/Kolkata' },
        end: { dateTime: finalEnd, timeZone: 'Asia/Kolkata' },
        colorId: '6' // Berry/purple color index
      }
    });

    // Update task in MongoDB
    task.status = 'In Progress';
    task.quadrant = 'Schedule';
    await task.save();

    res.status(200).json({
      success: true,
      message: 'AI micro-chunk task scheduled successfully.',
      event: event.data,
      slot: { start: new Date(finalStart), end: new Date(finalEnd) },
      aiDetails: parsedAI
    });

  } catch (error: any) {
    console.error('Error scheduling task on calendar:', error);
    res.status(500).json({ error: 'Failed to schedule task on Google Calendar.', details: error.message });
  }
});

export default router;
