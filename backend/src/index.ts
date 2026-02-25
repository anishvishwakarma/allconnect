import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Server as SocketServer } from 'socket.io';
import cron from 'node-cron';

import { connectDatabase } from './config/database';
import { initFirebase } from './config/firebase';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import postRoutes from './routes/posts';
import chatRoutes from './routes/chat';
import joinRequestRoutes from './routes/joinRequests';

import { initChatSocket } from './sockets/chatSocket';
import { globalLimiter } from './middleware/rateLimiter';

import { Post } from './models/Post';
import { GroupChat } from './models/GroupChat';

// ── App setup ────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  path: '/socket.io',
});
app.set('io', io);
initChatSocket(io);

// ── Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', joinRequestRoutes);   // /api/posts/:id/request, /api/requests/mine

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Cron: expire old posts & chats every 5 minutes ──────
cron.schedule('*/5 * * * *', async () => {
  const now = new Date();
  try {
    // Expire posts
    const expiredPosts = await Post.find({
      status: { $in: ['active', 'full'] },
      expiresAt: { $lt: now },
    });
    if (expiredPosts.length) {
      await Post.updateMany(
        { _id: { $in: expiredPosts.map((p) => p._id) } },
        { status: 'expired' }
      );
    }

    // Expire group chats
    const expiredChats = await GroupChat.find({ isActive: true, expiresAt: { $lt: now } });
    if (expiredChats.length) {
      await GroupChat.updateMany(
        { _id: { $in: expiredChats.map((c) => c._id) } },
        { isActive: false }
      );
      // Notify rooms
      expiredChats.forEach((c) => {
        io.to(`chat:${c._id}`).emit('chat:expired', { chatId: c._id });
      });
    }

    // Reset monthly post counts (1st of month at midnight)
    const date = new Date();
    if (date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() < 5) {
      const { modifiedCount } = await import('./models/User').then((m) =>
        m.User.updateMany({}, { postsThisMonth: 0 })
      );
      console.log(`🔄 Reset postsThisMonth for ${modifiedCount} users`);
    }
  } catch (err) {
    console.error('Cron error:', err);
  }
});

// ── Start ────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;

async function start(): Promise<void> {
  initFirebase(); // logs a warning if not configured; auth will fail until Firebase is set
  await connectDatabase();
  server.listen(PORT, () => {
    console.log(`\n🚀 AllConnect API running on http://localhost:${PORT}`);
    console.log(`   Socket.io  →  ws://localhost:${PORT}/socket.io`);
    console.log(`   Health     →  http://localhost:${PORT}/api/health\n`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
