import { Request, Response } from 'express';
import { User } from '../models/User';
import { sendError, sendSuccess } from '../utils/helpers';

// GET /api/users/me
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).lean();
    if (!user) { sendError(res, 404, 'User not found'); return; }

    sendSuccess(res, {
      id: user._id,
      mobile: user.phone,
      email: user.email || null,
      name: user.name || null,
      avatar_uri: user.avatar || null,
      bio: user.bio || null,
      posts_this_month: user.postsThisMonth,
      subscription_ends_at: user.subscriptionEndsAt || null,
    });
  } catch {
    sendError(res, 500, 'Failed to fetch user');
  }
}

// PUT /api/users/me
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const { name, bio, avatar, email } = req.body as {
      name?: string;
      bio?: string;
      avatar?: string;
      email?: string;
    };

    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      {
        ...(name !== undefined && { name: name.trim().slice(0, 60) }),
        ...(bio !== undefined && { bio: bio.trim().slice(0, 200) }),
        ...(avatar !== undefined && { avatar }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
      },
      { new: true, runValidators: true }
    ).lean();

    if (!user) { sendError(res, 404, 'User not found'); return; }

    sendSuccess(res, {
      id: user._id,
      mobile: user.phone,
      email: user.email || null,
      name: user.name || null,
      avatar_uri: user.avatar || null,
      bio: user.bio || null,
      posts_this_month: user.postsThisMonth,
      subscription_ends_at: user.subscriptionEndsAt || null,
    });
  } catch {
    sendError(res, 500, 'Failed to update user');
  }
}
