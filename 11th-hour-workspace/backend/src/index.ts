import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    app.listen(PORT, () => {
      console.log(`Server running in development mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();
