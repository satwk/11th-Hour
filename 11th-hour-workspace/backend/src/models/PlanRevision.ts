import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPlanChange {
  taskId: Types.ObjectId;
  action: 'reslot' | 'rechunk' | 'downgrade' | 'draft-message' | 'requeue';
  reason: string;
  proposedSlot?: {
    start?: Date;
    end?: Date;
  };
  draftMessage?: string;
}

export interface IPlanRevision extends Document {
  userId: Types.ObjectId;
  generatedAt: Date;
  triggerType: 'scheduled' | 'manual' | 'escalation';
  changes: IPlanChange[];
  userConfirmed: boolean;
  confirmedAt?: Date;
}

const PlanRevisionSchema = new Schema<IPlanRevision>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  generatedAt: { type: Date, default: Date.now },
  triggerType: { type: String, enum: ['scheduled', 'manual', 'escalation'], required: true },
  changes: [{
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    action: { type: String, enum: ['reslot', 'rechunk', 'downgrade', 'draft-message', 'requeue'] },
    reason: String,
    proposedSlot: { start: Date, end: Date },
    draftMessage: String
  }],
  userConfirmed: { type: Boolean, default: false },
  confirmedAt: Date
});

export const PlanRevision = mongoose.model<IPlanRevision>('PlanRevision', PlanRevisionSchema);
export default PlanRevision;
