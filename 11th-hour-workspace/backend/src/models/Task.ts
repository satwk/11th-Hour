import { Schema, model, Types } from 'mongoose';

export interface ITask {
  userId: Types.ObjectId;
  title: string;
  quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Delete';
  cognitiveLoad: number; // validated 1-5
  estimatedDuration: number; // estimated duration in minutes
  status: 'Not Started' | 'In Progress' | 'Completed';
  externallyDependent: boolean;
  lastEscalationStep: number;
  scheduleConstraint?: {
    targetDate?: string;
    timeOfDay?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  quadrant: { type: String, enum: ['Do', 'Schedule', 'Delegate', 'Delete'], required: true, index: true },
  cognitiveLoad: { type: Number, required: true, min: 1, max: 5 },
  estimatedDuration: { type: Number, required: true },
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started', index: true },
  externallyDependent: { type: Boolean, default: false },
  lastEscalationStep: { type: Number, default: 0 },
  scheduleConstraint: {
    targetDate: { type: String },
    timeOfDay: { type: String }
  },
}, {
  timestamps: true
});

export const Task = model<ITask>('Task', TaskSchema);
