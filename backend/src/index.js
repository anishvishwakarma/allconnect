import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { initDb } from './db/client.js';
import { initScheduler } from './scheduler/autoDelete.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import usersRoutes from './routes/users.js';
import chatsRoutes from './routes/chats.js';

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: { origin: '*' },
  path: '/socket.io',
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, db: 'postgres' }));

app.set('io', io);

app.use((_, res) => res.status(404).json({ error: 'Not found' }));

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => socket.join(roomId));
  socket.on('leave_room', (roomId) => socket.leave(roomId));
  socket.on('chat:join', (chatId) => socket.join(`group:${chatId}`));
  socket.on('chat:leave', (chatId) => socket.leave(`group:${chatId}`));
});

const PORT = process.env.PORT || 4000;

async function start() {
  await initDb();
  initScheduler();
  server.listen(PORT, () => {
    console.log(`\n🚀 AllConnect API (PostgreSQL) on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

start().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
