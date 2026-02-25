import { Request, Response } from 'express';
import { verifyFirebaseToken } from '../config/firebase';
import { User } from '../models/User';
import { signToken } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/helpers';

export async function verifyAuth(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    sendError(res, 400, 'idToken is required');
    return;
  }

  try {
    // Verify the Firebase ID token
    const decoded = await verifyFirebaseToken(idToken);
    const { uid, phone_number } = decoded;

    if (!phone_number) {
      sendError(res, 400, 'Token does not contain a phone number');
      return;
    }

    // Upsert user
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        phone: phone_number,
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
