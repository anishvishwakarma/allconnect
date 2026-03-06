import { Request, Response } from 'express';
import { GroupChat } from '../models/GroupChat';
import { Message } from '../models/Message';
import { sendError, sendSuccess } from '../utils/helpers';

// GET /api/chats  — user's active group chats
export async function getMyChats(req: Request, res: Response): Promise<void> {
  try {
    const chats = await GroupChat.find({
      members: req.user!.userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('postId', 'title category eventAt')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, chats.map((c) => {
      const p = c.postId as any;
      return {
        id: c._id,
        name: c.name,
        post_id: p?._id || null,
        title: p?.title ?? c.name,
        category: p?.category || null,
        event_at: p?.eventAt || null,
        expires_at: c.expiresAt,
        member_count: c.members.length,
      };
    }));
  } catch {
    sendError(res, 500, 'Failed to fetch chats');
  }
}

// GET /api/chats/:chatId/messages
export async function getChatMessages(req: Request, res: Response): Promise<void> {
  try {
    const { chatId } = req.params;
    const chat = await GroupChat.findById(chatId);
    if (!chat) { sendError(res, 404, 'Chat not found'); return; }

    const isMember = chat.members.map(String).includes(req.user!.userId);
    if (!isMember) { sendError(res, 403, 'Not a member of this chat'); return; }

    const messages = await Message.find({ chatId })
      .populate('senderId', 'name phone avatar')
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    sendSuccess(res, messages.map((m) => {
      const s = m.senderId as any;
      return {
        id: m._id,
        user_id: s?._id || m.senderId,
        sender_name: s?.name || null,
        body: m.text,
        created_at: m.createdAt,
      };
    }));
  } catch {
    sendError(res, 500, 'Failed to fetch messages');
  }
}

// POST /api/chats/:chatId/messages  (REST fallback — sockets preferred)
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { chatId } = req.params;
    const { text } = req.body as { text?: string };
    if (!text?.trim()) { sendError(res, 400, 'text is required'); return; }

    const chat = await GroupChat.findById(chatId);
    if (!chat) { sendError(res, 404, 'Chat not found'); return; }
    if (!chat.isActive || chat.expiresAt < new Date()) {
      sendError(res, 410, 'This chat has expired'); return;
    }

    const isMember = chat.members.map(String).includes(req.user!.userId);
    if (!isMember) { sendError(res, 403, 'Not a member of this chat'); return; }

    const message = await Message.create({
      chatId,
      senderId: req.user!.userId,
      text: text.trim(),
    });

    // Emit via socket (if io is available on app)
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit('chat:message', {
        id: message._id,
        user_id: req.user!.userId,
        body: message.text,
        created_at: message.createdAt,
      });
    }

    sendSuccess(res, {
      id: message._id,
      user_id: req.user!.userId,
      body: message.text,
      created_at: message.createdAt,
    }, 201);
  } catch {
    sendError(res, 500, 'Failed to send message');
  }
}
