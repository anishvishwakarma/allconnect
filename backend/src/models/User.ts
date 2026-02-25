import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firebaseUid: string;
  phone: string;
  name?: string;
  avatar?: string;
  bio?: string;
  postsThisMonth: number;
  subscriptionEndsAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true, maxlength: 60 },
    avatar: { type: String },
    bio: { type: String, maxlength: 200 },
    postsThisMonth: { type: Number, default: 0, min: 0 },
    subscriptionEndsAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
