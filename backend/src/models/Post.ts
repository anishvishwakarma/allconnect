import mongoose, { Document, Schema, Types } from 'mongoose';

export const POST_CATEGORIES = [
  'activity', 'need', 'selling', 'meetup',
  'event', 'study', 'nightlife', 'other',
] as const;

export type PostCategory = typeof POST_CATEGORIES[number];

export const POST_STATUSES = ['active', 'full', 'expired', 'cancelled'] as const;
export type PostStatus = typeof POST_STATUSES[number];

export interface IPost extends Document {
  title: string;
  description?: string;
  category: PostCategory;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  addressText?: string;
  eventAt: Date;
  durationMinutes: number;
  expiresAt: Date;
  costPerPerson: number;
  maxParticipants: number;
  participantCount: number;
  hostId: Types.ObjectId;
  approvalRequired: boolean;
  status: PostStatus;
  groupChatId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000 },
    category: { type: String, enum: POST_CATEGORIES, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) => v.length === 2,
          message: 'coordinates must be [lng, lat]',
        },
      },
    },
    addressText: { type: String, trim: true, maxlength: 200 },
    eventAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 1440 },
    expiresAt: { type: Date, required: true },
    costPerPerson: { type: Number, default: 0, min: 0 },
    maxParticipants: { type: Number, required: true, min: 2, max: 100 },
    participantCount: { type: Number, default: 1 },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvalRequired: { type: Boolean, default: true },
    status: { type: String, enum: POST_STATUSES, default: 'active' },
    groupChatId: { type: Schema.Types.ObjectId, ref: 'GroupChat' },
  },
  { timestamps: true }
);

// Geospatial index for nearby queries
PostSchema.index({ location: '2dsphere' });
PostSchema.index({ hostId: 1 });
PostSchema.index({ status: 1 });
PostSchema.index({ eventAt: 1 });
PostSchema.index({ expiresAt: 1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
