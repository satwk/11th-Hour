import { Schema, model, Types } from 'mongoose';

export interface IReadinessLog {
  userId: Types.ObjectId;
  energyLevel: number; // 1-5
  sleepHours: number;
  dailyWinsCount: number;
  calculatedScore: number; // 0-100 score
  createdAt: Date;
  updatedAt: Date;
}

const ReadinessLogSchema = new Schema<IReadinessLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  energyLevel: { type: Number, required: true, min: 1, max: 5 },
  sleepHours: { type: Number, required: true, min: 0 },
  dailyWinsCount: { type: Number, default: 0, min: 0 },
  calculatedScore: { type: Number, required: true, min: 0, max: 100 },
}, {
  timestamps: true
});

// Compound index to ensure only one readiness log entry per user per day (approx)
// We will manage actual date limits in application logic, but index user/createdAt
ReadinessLogSchema.index({ userId: 1, createdAt: -1 });

export const ReadinessLog = model<IReadinessLog>('ReadinessLog', ReadinessLogSchema);
