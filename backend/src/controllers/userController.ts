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
      phone: user.phone,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      postsThisMonth: user.postsThisMonth,
      subscriptionEndsAt: user.subscriptionEndsAt,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch {
    sendError(res, 500, 'Failed to fetch user');
  }
}

// PUT /api/users/me
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const { name, bio, avatar } = req.body as { name?: string; bio?: string; avatar?: string };

    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      {
        ...(name !== undefined && { name: name.trim().slice(0, 60) }),
        ...(bio !== undefined && { bio: bio.trim().slice(0, 200) }),
        ...(avatar !== undefined && { avatar }),
      },
      { new: true, runValidators: true }
    ).lean();

    if (!user) { sendError(res, 404, 'User not found'); return; }

    sendSuccess(res, {
      id: user._id,
      phone: user.phone,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
    });
  } catch {
    sendError(res, 500, 'Failed to update user');
  }
}
