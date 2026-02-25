import { Request, Response } from 'express';
import { JoinRequest } from '../models/JoinRequest';
import { Post } from '../models/Post';
import { GroupChat } from '../models/GroupChat';
import { sendError, sendSuccess } from '../utils/helpers';
import { Types } from 'mongoose';

// POST /api/posts/:postId/request
export async function requestToJoin(req: Request, res: Response): Promise<void> {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const { message } = req.body as { message?: string };

    const post = await Post.findById(postId);
    if (!post) { sendError(res, 404, 'Post not found'); return; }
    if (post.status !== 'active') { sendError(res, 400, 'Post is no longer active'); return; }
    if (post.hostId.toString() === userId) { sendError(res, 400, 'You cannot join your own post'); return; }
    if (post.participantCount >= post.maxParticipants) { sendError(res, 400, 'Post is full'); return; }

    const existing = await JoinRequest.findOne({ postId, userId });
    if (existing) {
      sendError(res, 409, `You already have a ${existing.status} request for this post`);
      return;
    }

    const jreq = await JoinRequest.create({ postId, userId, message });
    sendSuccess(res, { id: jreq._id, status: jreq.status }, 201);
  } catch (err) {
    console.error('requestToJoin error:', err);
    sendError(res, 500, 'Failed to create request');
  }
}

// GET /api/posts/:postId/requests  (host only)
export async function getPostRequests(req: Request, res: Response): Promise<void> {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) { sendError(res, 404, 'Post not found'); return; }
    if (post.hostId.toString() !== req.user!.userId) {
      sendError(res, 403, 'Only the host can view requests');
      return;
    }

    const requests = await JoinRequest.find({ postId })
      .populate('userId', 'name phone avatar')
      .sort({ createdAt: 1 })
      .lean();

    sendSuccess(res, requests.map((r) => ({
      id: r._id,
      user: r.userId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
    })));
  } catch {
    sendError(res, 500, 'Failed to fetch requests');
  }
}

// PUT /api/posts/:postId/requests/:requestId  (host only — approve/reject)
export async function updateRequest(req: Request, res: Response): Promise<void> {
  try {
    const { postId, requestId } = req.params;
    const { action } = req.body as { action: 'approve' | 'reject' };

    if (!['approve', 'reject'].includes(action)) {
      sendError(res, 400, 'action must be approve or reject');
      return;
    }

    const post = await Post.findById(postId);
    if (!post) { sendError(res, 404, 'Post not found'); return; }
    if (post.hostId.toString() !== req.user!.userId) {
      sendError(res, 403, 'Only the host can manage requests');
      return;
    }

    const jreq = await JoinRequest.findById(requestId);
    if (!jreq || jreq.postId.toString() !== postId) {
      sendError(res, 404, 'Request not found');
      return;
    }
    if (jreq.status !== 'pending') {
      sendError(res, 400, 'Request already processed');
      return;
    }

    if (action === 'reject') {
      jreq.status = 'rejected';
      await jreq.save();
      sendSuccess(res, { id: jreq._id, status: jreq.status });
      return;
    }

    // Approve flow
    if (post.participantCount >= post.maxParticipants) {
      sendError(res, 400, 'Post is already full');
      return;
    }

    jreq.status = 'approved';
    await jreq.save();

    post.participantCount += 1;
    if (post.participantCount >= post.maxParticipants) post.status = 'full';
    await post.save();

    // Ensure group chat exists
    let chat = await GroupChat.findOne({ postId });
    if (!chat) {
      chat = await GroupChat.create({
        postId,
        name: post.title,
        members: [post.hostId, jreq.userId],
        expiresAt: post.expiresAt,
      });
      post.groupChatId = chat._id as Types.ObjectId;
      await post.save();
    } else if (!chat.members.map(String).includes(jreq.userId.toString())) {
      chat.members.push(jreq.userId);
      await chat.save();
    }

    sendSuccess(res, {
      id: jreq._id,
      status: jreq.status,
      chatId: chat._id,
    });
  } catch (err) {
    console.error('updateRequest error:', err);
    sendError(res, 500, 'Failed to update request');
  }
}

// GET /api/requests/mine
export async function getMyRequests(req: Request, res: Response): Promise<void> {
  try {
    const requests = await JoinRequest.find({ userId: req.user!.userId })
      .populate('postId', 'title category eventAt status')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, requests.map((r) => {
      const p = r.postId as any;
      return {
        id: r._id,
        post: p ? { id: p._id, title: p.title, category: p.category, eventAt: p.eventAt, status: p.status } : null,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
      };
    }));
  } catch {
    sendError(res, 500, 'Failed to fetch requests');
  }
}
