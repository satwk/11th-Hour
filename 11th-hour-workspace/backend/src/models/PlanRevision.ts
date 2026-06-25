import { Schema, model, Types } from 'mongoose';

export interface IPlanChange {
  taskId: Types.ObjectId;
  action: 'Task Reslotted' | 'Urgency Downgraded' | 'Draft ready';
  reason: string;
  proposedSlot?: string;
  draftMessage?: string;
}

export interface IPlanRevision {
  userId: Types.ObjectId;
  triggerType: 'daily-replan' | 'manual';
  changes: IPlanChange[];
  userConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanChangeSchema = new Schema<IPlanChange>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  action: { type: String, enum: ['Task Reslotted', 'Urgency Downgraded', 'Draft ready'], required: true },
  reason: { type: String, required: true },
  proposedSlot: { type: String },
  draftMessage: { type: String },
}, { _id: false });

const PlanRevisionSchema = new Schema<IPlanRevision>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  triggerType: { type: String, enum: ['daily-replan', 'manual'], required: true },
  changes: { type: [PlanChangeSchema], default: [] },
  userConfirmed: { type: Boolean, default: false, index: true },
}, {
  timestamps: true
});

export const PlanRevision = model<IPlanRevision>('PlanRevision', PlanRevisionSchema);
