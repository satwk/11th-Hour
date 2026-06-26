import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { User } from '../models/User';
import { Task } from '../models/Task';

const router = Router();

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
      { googleAccessToken: undefined, calendarSyncEnabled: false },
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

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.googleAccessToken });
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

// Endpoint to auto-schedule a task in the first available slot
router.post('/schedule-task', async (req: Request, res: Response): Promise<void> => {
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

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.googleAccessToken });
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

    // Get list of existing events to build busy slots
    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: sevenDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const busySlots = (eventsResponse.data.items || [])
      .map((e) => {
        const start = new Date(e.start?.dateTime || e.start?.date || '');
        const end = new Date(e.end?.dateTime || e.end?.date || '');
        return { start, end };
      })
      .filter((s) => !isNaN(s.start.getTime()) && !isNaN(s.end.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Search for first available waking-hours gap of size 'estimatedDuration'
    const durationMs = task.estimatedDuration * 60 * 1000;
    let candidateTime = new Date(now.getTime() + 15 * 60 * 1000); // start 15m from now
    
    // Round to next 15-minute interval
    candidateTime.setMinutes(Math.ceil(candidateTime.getMinutes() / 15) * 15, 0, 0);

    let foundSlot: { start: Date; end: Date } | null = null;
    const maxSearchTime = sevenDaysLater.getTime();

    while (candidateTime.getTime() < maxSearchTime) {
      const candidateStart = new Date(candidateTime.getTime());
      const candidateEnd = new Date(candidateTime.getTime() + durationMs);

      // Check timezone-specific waking hours (8 AM to 8 PM)
      let isWakingHours = true;
      try {
        const hourOptions = { timeZone: timezone, hour: 'numeric', hour12: false } as const;
        const startHour = Number(new Intl.DateTimeFormat('en-US', hourOptions).format(candidateStart));
        const endHour = Number(new Intl.DateTimeFormat('en-US', hourOptions).format(candidateEnd));
        isWakingHours = startHour >= 8 && endHour <= 20;
      } catch (err) {
        // Fallback to UTC
        const startHour = candidateStart.getUTCHours();
        const endHour = candidateEnd.getUTCHours();
        isWakingHours = startHour >= 8 && endHour <= 20;
      }

      if (!isWakingHours) {
        // Step forward by 15m
        candidateTime = new Date(candidateTime.getTime() + 15 * 60 * 1000);
        continue;
      }

      // Check if candidate overlaps with any busy slot
      const overlappingEvent = busySlots.find(
        (slot) => candidateStart < slot.end && candidateEnd > slot.start
      );

      if (overlappingEvent) {
        // Optimization: Jump to the end of the overlapping event
        candidateTime = new Date(overlappingEvent.end.getTime());
        // Align to next 15-min
        candidateTime.setMinutes(Math.ceil(candidateTime.getMinutes() / 15) * 15, 0, 0);
      } else {
        // Found a slot!
        foundSlot = { start: candidateStart, end: candidateEnd };
        break;
      }
    }

    if (!foundSlot) {
      res.status(400).json({ error: 'No available calendar slot found in the next 7 days.' });
      return;
    }

    // Write event to Google Calendar
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `[11th Hour] ${task.title}`,
        description: 'Auto-scheduled based on estimated cognitive load and duration constraints.',
        start: { dateTime: foundSlot.start.toISOString() },
        end: { dateTime: foundSlot.end.toISOString() },
        colorId: '1' // Lavender/blue style
      }
    });

    // Update task in db
    task.status = 'In Progress';
    task.quadrant = 'Schedule'; // Demote/promote as scheduled
    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task successfully scheduled on Google Calendar.',
      event: event.data,
      slot: foundSlot
    });

  } catch (error: any) {
    console.error('Error scheduling task on calendar:', error);
    res.status(500).json({ error: 'Failed to schedule task on Google Calendar.', details: error.message });
  }
});

export default router;
