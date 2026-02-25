import { Request, Response } from 'express';
import { Post, POST_CATEGORIES } from '../models/Post';
import { User } from '../models/User';
import { GroupChat } from '../models/GroupChat';
import { JoinRequest } from '../models/JoinRequest';
import { sendError, sendSuccess, calcExpiresAt, hasReachedFreeLimit } from '../utils/helpers';

// GET /api/posts/nearby
export async function getNearbyPosts(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius = '10', category, from, to } = req.query as Record<string, string>;

  if (!lat || !lng) {
    sendError(res, 400, 'lat and lng are required');
    return;
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radiusKm = Math.min(parseFloat(radius) || 10, 50); // cap at 50km

  if (isNaN(latitude) || isNaN(longitude)) {
    sendError(res, 400, 'Invalid lat/lng');
    return;
  }

  const filter: Record<string, unknown> = {
    status: 'active',
    expiresAt: { $gt: new Date() },
    location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: radiusKm * 1000, // metres
      },
    },
  };

  if (category && POST_CATEGORIES.includes(category as any)) {
    filter.category = category;
  }

  if (from || to) {
    filter.eventAt = {};
    if (from) (filter.eventAt as any).$gte = new Date(from);
    if (to) (filter.eventAt as any).$lte = new Date(to);
  }

  try {
    const posts = await Post.find(filter)
      .select('title category location addressText eventAt durationMinutes costPerPerson maxParticipants participantCount status')
      .limit(100)
      .lean();

    const result = posts.map((p) => ({
      id: p._id,
      title: p.title,
      category: p.category,
      lat: p.location.coordinates[1],
      lng: p.location.coordinates[0],
      addressText: p.addressText,
      eventAt: p.eventAt,
      durationMinutes: p.durationMinutes,
      costPerPerson: p.costPerPerson,
      maxParticipants: p.maxParticipants,
      participantCount: p.participantCount,
      status: p.status,
    }));

    sendSuccess(res, result);
  } catch (err) {
    console.error('getNearbyPosts error:', err);
    sendError(res, 500, 'Failed to fetch posts');
  }
}

// GET /api/posts/mine
export async function getMyPosts(req: Request, res: Response): Promise<void> {
  try {
    const posts = await Post.find({ hostId: req.user!.userId })
      .sort({ createdAt: -1 })
      .lean();

    const result = posts.map((p) => ({
      id: p._id,
      title: p.title,
      category: p.category,
      eventAt: p.eventAt,
      status: p.status,
      participantCount: p.participantCount,
      maxParticipants: p.maxParticipants,
      role: 'created',
    }));
    sendSuccess(res, result);
  } catch {
    sendError(res, 500, 'Failed to fetch posts');
  }
}

// GET /api/posts/history
export async function getPostHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Posts user created
    const createdPosts = await Post.find({ hostId: userId })
      .sort({ createdAt: -1 })
      .select('title category eventAt status')
      .lean();

    // Posts user joined (approved requests)
    const approvedRequests = await JoinRequest.find({ userId, status: 'approved' })
      .populate<{ postId: { _id: unknown; title: string; category: string; eventAt: Date; status: string } }>({
        path: 'postId',
        select: 'title category eventAt status',
      })
      .lean();

    const created = createdPosts.map((p) => ({
      id: p._id,
      title: p.title,
      category: p.category,
      eventAt: p.eventAt,
      status: p.status,
      role: 'created',
    }));

    const joined = approvedRequests
      .filter((r) => r.postId)
      .map((r) => {
        const p = r.postId as any;
        return {
          id: p._id,
          title: p.title,
          category: p.category,
          eventAt: p.eventAt,
          status: p.status,
          role: 'joined',
        };
      });

    // Merge and sort by eventAt desc
    const combined = [...created, ...joined].sort(
      (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime()
    );

    sendSuccess(res, combined);
  } catch (err) {
    console.error('getPostHistory error:', err);
    sendError(res, 500, 'Failed to fetch history');
  }
}

// GET /api/posts/:id
export async function getPost(req: Request, res: Response): Promise<void> {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) {
      sendError(res, 404, 'Post not found');
      return;
    }
    sendSuccess(res, {
      id: post._id,
      title: post.title,
      description: post.description,
      category: post.category,
      lat: post.location.coordinates[1],
      lng: post.location.coordinates[0],
      addressText: post.addressText,
      eventAt: post.eventAt,
      durationMinutes: post.durationMinutes,
      expiresAt: post.expiresAt,
      costPerPerson: post.costPerPerson,
      maxParticipants: post.maxParticipants,
      participantCount: post.participantCount,
      hostId: post.hostId,
      approvalRequired: post.approvalRequired,
      status: post.status,
      groupChatId: post.groupChatId,
    });
  } catch {
    sendError(res, 500, 'Failed to fetch post');
  }
}

// POST /api/posts
export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      sendError(res, 404, 'User not found');
      return;
    }

    if (hasReachedFreeLimit(user.postsThisMonth, user.subscriptionEndsAt)) {
      sendError(res, 403, 'Free plan limit reached (5 posts/month). Upgrade to continue.');
      return;
    }

    const {
      title, description, category, lat, lng, addressText,
      eventAt, durationMinutes, costPerPerson, maxParticipants, approvalRequired,
    } = req.body;

    const eventDate = new Date(eventAt);
    const expiresAt = calcExpiresAt(eventDate, Number(durationMinutes));

    const post = await Post.create({
      title,
      description,
      category,
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      addressText,
      eventAt: eventDate,
      durationMinutes: Number(durationMinutes),
      expiresAt,
      costPerPerson: Number(costPerPerson) || 0,
      maxParticipants: Number(maxParticipants),
      hostId: user._id,
      approvalRequired: approvalRequired !== false,
    });

    // Increment post count
    await User.findByIdAndUpdate(user._id, { $inc: { postsThisMonth: 1 } });

    sendSuccess(res, { id: post._id, ...post.toObject() }, 201);
  } catch (err: any) {
    console.error('createPost error:', err);
    sendError(res, 500, 'Failed to create post');
  }
}

// DELETE /api/posts/:id
export async function deletePost(req: Request, res: Response): Promise<void> {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      sendError(res, 404, 'Post not found');
      return;
    }
    if (post.hostId.toString() !== req.user!.userId) {
      sendError(res, 403, 'Only the host can delete this post');
      return;
    }
    await post.deleteOne();
    sendSuccess(res, { message: 'Post deleted' });
  } catch {
    sendError(res, 500, 'Failed to delete post');
  }
}
