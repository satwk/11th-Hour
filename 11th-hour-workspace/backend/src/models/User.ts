import { Schema, model, Document } from 'mongoose';

export interface IUser {
  firebaseId: string;
  email: string;
  googleAccessToken?: string;
  calendarSyncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  firebaseId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  googleAccessToken: { type: String },
  calendarSyncEnabled: { type: Boolean, default: false },
}, {
  timestamps: true
});

export const User = model<IUser>('User', UserSchema);
