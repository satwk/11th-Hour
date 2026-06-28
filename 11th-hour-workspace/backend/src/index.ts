import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import taskRoutes from './routes/taskRoutes';
import agentRoutes from './routes/agentRoutes';
import calendarRoutes from './routes/calendarRoutes';
import authRoutes from './routes/authRoutes';
import readinessRoutes from './routes/readinessRoutes';
import { initCron } from './config/cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/readiness', readinessRoutes);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '11th Hour API service is healthy',
    timestamp: new Date()
  });
});

// Start Server after DB connection
const startServer = async () => {
  try {
    await connectDB();
    initCron();
    app.listen(PORT, () => {
      console.log(`Server running in development mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();
