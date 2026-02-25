import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message } from '../models/Message';
import { GroupChat } from '../models/GroupChat';

interface SocketUser {
  userId: string;
  phone: string;
}

function extractUser(token: string): SocketUser | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as SocketUser;
  } catch {
    return null;
  }
}

export function initChatSocket(io: SocketServer): void {
  // Auth middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const user = extractUser(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }
    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user: SocketUser = (socket as any).user;
    console.log(`🔌 Socket connected: ${user.userId}`);

    // Join a chat room
    socket.on('chat:join', async (chatId: string) => {
      try {
        const chat = await GroupChat.findById(chatId);
        if (!chat) return;
        const isMember = chat.members.map(String).includes(user.userId);
        if (!isMember) return;
        socket.join(`chat:${chatId}`);
        socket.emit('chat:joined', { chatId });
      } catch (err) {
        console.error('chat:join error:', err);
      }
    });

    // Leave a chat room
    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    // Send a message
    socket.on('chat:send', async ({ chatId, text }: { chatId: string; text: string }) => {
      try {
        if (!text?.trim() || !chatId) return;

        const chat = await GroupChat.findById(chatId);
        if (!chat || !chat.isActive || chat.expiresAt < new Date()) {
          socket.emit('chat:error', { message: 'Chat has expired' });
          return;
        }

        const isMember = chat.members.map(String).includes(user.userId);
        if (!isMember) {
          socket.emit('chat:error', { message: 'Not a member' });
          return;
        }

        const message = await Message.create({
          chatId,
          senderId: user.userId,
          text: text.trim().slice(0, 2000),
        });

        const payload = {
          id: message._id,
          chatId,
          senderId: user.userId,
          text: message.text,
          createdAt: message.createdAt,
        };

        // Broadcast to room (including sender)
        io.to(`chat:${chatId}`).emit('chat:message', payload);
      } catch (err) {
        console.error('chat:send error:', err);
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('chat:typing', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('chat:typing', { userId: user.userId, chatId });
    });

    socket.on('chat:stop_typing', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('chat:stop_typing', { userId: user.userId, chatId });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.userId}`);
    });
  });
}
