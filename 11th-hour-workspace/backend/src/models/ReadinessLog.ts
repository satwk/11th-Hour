import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReadinessLog extends Document {
  userId: Types.ObjectId;
  logDate: Date;
  sleepHours: number;
  energyLevel: number; // 1-5 primary tap-in path
  dailyWinsCount: number;
  inputMethod: 'tap' | 'vision';
  calculatedScore: number;
}

const ReadinessLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  logDate: { type: Date, default: Date.now },
  sleepHours: Number,
  energyLevel: Number,        // 1-5 primary tap-in path
  dailyWinsCount: Number,
  inputMethod: { type: String, enum: ['tap', 'vision'], default: 'tap' },
  calculatedScore: { type: Number, min: 0, max: 100 }
});

export const ReadinessLog = mongoose.model<IReadinessLog>('ReadinessLog', ReadinessLogSchema);
export default ReadinessLog;
