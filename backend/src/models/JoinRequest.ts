import mongoose, { Document, Schema, Types } from 'mongoose';

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export interface IJoinRequest extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  status: RequestStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JoinRequestSchema = new Schema<IJoinRequest>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending' },
    message: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

JoinRequestSchema.index({ postId: 1, userId: 1 }, { unique: true });
JoinRequestSchema.index({ userId: 1 });
JoinRequestSchema.index({ postId: 1, status: 1 });

export const JoinRequest = mongoose.model<IJoinRequest>('JoinRequest', JoinRequestSchema);
