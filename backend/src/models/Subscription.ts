import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired';
  startsAt: Date;
  endsAt: Date;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    paymentId: { type: String },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ status: 1, endsAt: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
