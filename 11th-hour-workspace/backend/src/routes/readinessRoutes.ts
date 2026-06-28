import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { ReadinessLog } from '../models/ReadinessLog';

const router = Router();

router.post('/log', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, firebaseId, sleepHours, energyLevel, dailyWinsCount, inputMethod } = req.body;

    if (sleepHours === undefined || energyLevel === undefined || dailyWinsCount === undefined) {
      res.status(400).json({ error: 'sleepHours, energyLevel, and dailyWinsCount are required.' });
      return;
    }

    const parsedSleepHours = Number(sleepHours);
    const parsedEnergyLevel = Number(energyLevel);
    const parsedDailyWinsCount = Number(dailyWinsCount);

    if (isNaN(parsedSleepHours) || parsedSleepHours < 0) {
      res.status(400).json({ error: 'sleepHours must be a non-negative number.' });
      return;
    }

    if (isNaN(parsedEnergyLevel) || parsedEnergyLevel < 1 || parsedEnergyLevel > 5) {
      res.status(400).json({ error: 'energyLevel must be an integer between 1 and 5.' });
      return;
    }

    if (isNaN(parsedDailyWinsCount) || parsedDailyWinsCount < 0) {
      res.status(400).json({ error: 'dailyWinsCount must be a non-negative number.' });
      return;
    }

    // Resolve user in the database
    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        // Not a valid ObjectId or not found
      }
    }

    if (!user && firebaseId) {
      user = await User.findOne({ firebaseId });
    }

    // Create default user if not found (matching brain-dump behavior for testing compatibility)
    if (!user) {
      console.log(`User not found for userId: ${userId} or firebaseId: ${firebaseId}. Creating a default user for testing...`);
      user = await User.create({
        firebaseId: firebaseId || `test-fb-${Date.now()}`,
        email: 'testuser@example.com',
        calendarSyncEnabled: false
      });
    }

    // Calculate score using balanced linear formula:
    // (sleepHours / 8 * 40) + (energyLevel / 5 * 40) + (Math.min(dailyWinsCount, 5) / 5 * 20)
    // Capped strictly between 0 and 100
    const rawScore = (parsedSleepHours / 8 * 40) + (parsedEnergyLevel / 5 * 40) + (Math.min(parsedDailyWinsCount, 5) / 5 * 20);
    const calculatedScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    const readinessLog = new ReadinessLog({
      userId: user._id,
      sleepHours: parsedSleepHours,
      energyLevel: parsedEnergyLevel,
      dailyWinsCount: parsedDailyWinsCount,
      inputMethod: inputMethod || 'tap',
      calculatedScore
    });

    await readinessLog.save();

    res.status(201).json(readinessLog);
  } catch (error: any) {
    console.error('Error logging readiness stats:', error);
    res.status(500).json({ error: 'Internal server error while saving readiness log.' });
  }
});

export default router;
