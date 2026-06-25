import { Router, Request, Response } from 'express';
import { runDailyReplan } from '../services/replanService';
import { User } from '../models/User';

const router = Router();

router.post('/daily-replan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, firebaseId, energyStats } = req.body;

    if (!userId && !firebaseId) {
      res.status(400).json({ error: 'userId or firebaseId is required.' });
      return;
    }

    // Resolve user
    let user = null;
    if (userId) {
      try {
        user = await User.findById(userId);
      } catch (err) {
        // If not a valid ObjectId, we will search by firebaseId
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

    // Validate energy stats if passed
    if (energyStats) {
      const { energyLevel, sleepHours } = energyStats;
      if (energyLevel === undefined || sleepHours === undefined) {
        res.status(400).json({ error: 'energyLevel and sleepHours are required inside energyStats.' });
        return;
      }
      if (energyLevel < 1 || energyLevel > 5) {
        res.status(400).json({ error: 'energyLevel must be between 1 and 5.' });
        return;
      }
      if (sleepHours < 0) {
        res.status(400).json({ error: 'sleepHours must be a non-negative number.' });
        return;
      }
    }

    // Call service to run daily replan
    const result = await runDailyReplan(user._id, energyStats);

    if (result.success === false) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);

  } catch (error: any) {
    console.error('Error in /api/agent/daily-replan:', error);
    res.status(500).json({
      error: 'Failed to complete daily replan execution.',
      details: error.message || error
    });
  }
});

export default router;
