import { Request, Response } from 'express';
import { verifyFirebaseToken } from '../config/firebase';
import { User } from '../models/User';
import { signToken } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/helpers';

export async function verifyAuth(req: Request, res: Response): Promise<void> {
  const { idToken, mobile } = req.body as { idToken?: string; mobile?: string };
  if (!idToken) {
    sendError(res, 400, 'idToken is required');
    return;
  }

  try {
    // Verify the Firebase ID token
    const decoded = await verifyFirebaseToken(idToken);
    const { uid, phone_number } = decoded;

    // phone_number present for phone-OTP auth; mobile from body for email/password auth
    const phone = phone_number || mobile || null;

    // Upsert user
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      if (!phone) {
        sendError(res, 400, 'Mobile number is required for registration');
        return;
      }
      // Prevent duplicate mobile registrations
      const duplicate = await User.findOne({ phone });
      if (duplicate) {
        sendError(res, 409, 'Mobile number already registered');
        return;
      }
      user = await User.create({
        firebaseUid: uid,
        phone,
      });
    }

    const token = signToken({ userId: user._id.toString(), phone: user.phone });

    sendSuccess(res, {
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        postsThisMonth: user.postsThisMonth,
        subscriptionEndsAt: user.subscriptionEndsAt,
      },
    });
  } catch (err: any) {
    if (err.code === 'auth/id-token-expired') {
      sendError(res, 401, 'Firebase token expired');
    } else if (err.code?.startsWith('auth/')) {
      sendError(res, 401, 'Invalid Firebase token');
    } else {
      console.error('Auth error:', err);
      sendError(res, 500, 'Authentication failed');
    }
  }
}
