import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runDailyReplan } from './services/replanService';
import { User } from './models/User';
import { Task } from './models/Task';
import { ReadinessLog } from './models/ReadinessLog';
import { PlanRevision } from './models/PlanRevision';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your-gemini-api-key-here') {
  console.error('Error: GEMINI_API_KEY is not configured in .env file.');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/11th-hour';

const runTest = async () => {
  try {
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    // 1. Create/Find Test User
    let user = await User.findOne({ email: 'test-replan-user@example.com' });
    if (!user) {
      user = await User.create({
        firebaseId: 'test-replan-fb-id',
        email: 'test-replan-user@example.com',
        calendarSyncEnabled: false
      });
    }

    // Clean old tasks
    await Task.deleteMany({ userId: user._id });
    await ReadinessLog.deleteMany({ userId: user._id });
    await PlanRevision.deleteMany({ userId: user._id });

    // 2. Insert Mock Tasks
    console.log('Inserting mock tasks for user...');
    const taskA = await Task.create({
      userId: user._id,
      title: 'Write complex thesis section on agent neural search',
      quadrant: 'Do',
      matrixQuadrant: 'Do_First',
      isUrgent: true,
      isImportant: true,
      cognitiveLoad: 5,
      estimatedDuration: 180,
      status: 'Not Started',
      externallyDependent: false
    });

    const taskB = await Task.create({
      userId: user._id,
      title: 'Book dentist checkup',
      quadrant: 'Schedule',
      matrixQuadrant: 'Schedule',
      isUrgent: false,
      isImportant: true,
      cognitiveLoad: 1,
      estimatedDuration: 15,
      status: 'Not Started',
      externallyDependent: false
    });

    const taskC = await Task.create({
      userId: user._id,
      title: 'Wait for database cluster access review from IT lead',
      quadrant: 'Delegate',
      matrixQuadrant: 'Delegate',
      isUrgent: true,
      isImportant: false,
      cognitiveLoad: 3,
      estimatedDuration: 30,
      status: 'In Progress',
      externallyDependent: true
    });

    const taskD = await Task.create({
      userId: user._id,
      title: 'Refactor production billing microservice with CTO',
      quadrant: 'Do',
      matrixQuadrant: 'Do_First',
      isUrgent: true,
      isImportant: true,
      cognitiveLoad: 5,
      estimatedDuration: 120,
      status: 'Not Started',
      externallyDependent: true
    });

    const taskE = await Task.create({
      userId: user._id,
      title: 'Review final board presentation deck slides',
      quadrant: 'Do',
      matrixQuadrant: 'Do_First',
      isUrgent: true,
      isImportant: true,
      cognitiveLoad: 5,
      estimatedDuration: 90,
      status: 'Not Started',
      externallyDependent: false
    });

    const taskF = await Task.create({
      userId: user._id,
      title: 'Submit quarterly tax returns',
      quadrant: 'Do',
      matrixQuadrant: 'Do_First',
      isUrgent: true,
      isImportant: true,
      cognitiveLoad: 3,
      estimatedDuration: 45,
      status: 'Not Started',
      externallyDependent: false
    });

    console.log('Created tasks:');
    console.log(`- [HIGH] ${taskA.title} (${taskA.quadrant})`);
    console.log(`- [LOW]  ${taskB.title} (${taskB.quadrant})`);
    console.log(`- [MED]  ${taskC.title} (${taskC.quadrant})`);
    console.log(`- [HIGH] ${taskD.title} (${taskD.quadrant})`);
    console.log(`- [HIGH] ${taskE.title} (${taskE.quadrant})`);
    console.log(`- [MED]  ${taskF.title} (${taskF.quadrant})\n`);

    // 3. Trigger Replan with low readiness (score = 40)
    console.log('Running daily replan execution with low energyStats (energyLevel: 2, sleepHours: 4, dailyWinsCount: 0)...');
    const energyStats = {
      energyLevel: 2,
      sleepHours: 4,
      dailyWinsCount: 0
    };

    const result = await runDailyReplan(user._id, energyStats);

    console.log('\n--- Replan Engine Result (Low Readiness Overload) ---');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Readiness Score: ${result.score}`);

    if (result.planRevision) {
      console.log('\nProposals stored in PlanRevision collection:');
      const revision = await PlanRevision.findById(result.planRevision._id).populate('changes.taskId');
      if (revision && revision.changes) {
        revision.changes.forEach((c: any, index: number) => {
          console.log(`\nProposal #${index + 1}:`);
          console.log(`  Task: "${c.taskId?.title}"`);
          console.log(`  Action: ${c.action}`);
          console.log(`  Reason: ${c.reason}`);
        });
      }
    }
    console.log('-----------------------------\n');

    // 4. Trigger Replan with high readiness (Surplus mode test)
    console.log('Cleaning and inserting mock tasks for Capacity Surplus test...');
    await Task.deleteMany({ userId: user._id });
    await ReadinessLog.deleteMany({ userId: user._id });
    await PlanRevision.deleteMany({ userId: user._id });

    // Active Q1 task (low load)
    await Task.create({
      userId: user._id,
      title: 'Reply to short email from client',
      quadrant: 'Do',
      matrixQuadrant: 'Do_First',
      isUrgent: true,
      isImportant: true,
      cognitiveLoad: 1,
      estimatedDuration: 10,
      status: 'Not Started',
      externallyDependent: false
    });

    // Promotable Q2 task due today
    await Task.create({
      userId: user._id,
      title: 'Study final exam prep for Algorithms',
      quadrant: 'Schedule',
      matrixQuadrant: 'Schedule',
      isUrgent: false,
      isImportant: true,
      cognitiveLoad: 4,
      estimatedDuration: 120,
      status: 'Not Started',
      externallyDependent: false,
      scheduleConstraint: {
        targetDate: new Date() // due today
      }
    });

    // Promotable Q3 task
    await Task.create({
      userId: user._id,
      title: 'Sort and archive old tax documents',
      quadrant: 'Delegate',
      matrixQuadrant: 'Delegate',
      isUrgent: true,
      isImportant: false,
      cognitiveLoad: 2,
      estimatedDuration: 30,
      status: 'Not Started',
      externallyDependent: false
    });

    console.log('Running daily replan execution with high energyStats (energyLevel: 5, sleepHours: 8, dailyWinsCount: 3)...');
    const highEnergyStats = {
      energyLevel: 5,
      sleepHours: 8,
      dailyWinsCount: 3
    };

    const surplusResult = await runDailyReplan(user._id, highEnergyStats);

    console.log('\n--- Replan Engine Result (Capacity Surplus Mode) ---');
    console.log(`Success: ${surplusResult.success}`);
    console.log(`Message: ${surplusResult.message}`);
    console.log(`Readiness Score: ${surplusResult.score}`);

    if (surplusResult.planRevision) {
      console.log('\nProposals stored in PlanRevision collection:');
      const revision = await PlanRevision.findById(surplusResult.planRevision._id).populate('changes.taskId');
      if (revision && revision.changes) {
        revision.changes.forEach((c: any, index: number) => {
          console.log(`\nProposal #${index + 1}:`);
          console.log(`  Task: "${c.taskId?.title}"`);
          console.log(`  Action: ${c.action}`);
          console.log(`  Reason: ${c.reason}`);
        });
      }
    }
    console.log('-----------------------------\n');
    console.log('All replan tests completed successfully!');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runTest();
