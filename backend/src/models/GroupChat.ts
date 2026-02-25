import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IGroupChat extends Document {
  postId: Types.ObjectId;
  name: string;
  members: Types.ObjectId[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GroupChatSchema = new Schema<IGroupChat>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

GroupChatSchema.index({ members: 1 });
GroupChatSchema.index({ expiresAt: 1 });
GroupChatSchema.index({ isActive: 1 });

export const GroupChat = mongoose.model<IGroupChat>('GroupChat', GroupChatSchema);
