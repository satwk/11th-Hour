import { User } from '../models/User';
import { runDailyReplan } from '../services/replanService';

// Initialize cron scheduler
export const initCron = (): void => {
  // Run daily at 9:00 AM
  // Pattern: "minute hour day-of-month month day-of-week"
  // "0 9 * * *" means every day at 9:00 AM
  import('node-cron')
    .then((cron) => {
      cron.schedule('0 9 * * *', async () => {
        console.log('[Cron] Daily Agent Loop triggered: Running daily replan evaluation...');
        try {
          // Find all users in database
          const users = await User.find({});
          console.log(`[Cron] Found ${users.length} user(s). Running replan audits.`);

          for (const user of users) {
            try {
              console.log(`[Cron] Auditing replan logs for user: ${user.email}`);
              const result = await runDailyReplan(user._id);
              console.log(`[Cron] Replan result for ${user.email}: ${result.message}`);
            } catch (userErr) {
              console.error(`[Cron] Error replanning for user ${user.email}:`, userErr);
            }
          }
        } catch (err) {
          console.error('[Cron] Critical error in daily replan cron loop:', err);
        }
      });
      console.log('[Cron] Daily Agent Loop scheduler registered (scheduled for 09:00 daily).');
    })
    .catch((err) => {
      console.error('[Cron] Failed to dynamically load node-cron:', err);
    });
};
