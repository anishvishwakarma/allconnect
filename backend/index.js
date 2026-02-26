require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const requestsRoutes = require('./routes/requests');
const chatsRoutes = require('./routes/chats');

const app = express();
const server = http.createServer(app);

// Required for correct client IP when behind Render/proxy (rate limiting, etc.)
app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim() ? process.env.CORS_ORIGIN.trim() : true;
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: corsOrigin },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ name: 'AllConnect API', health: '/health' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts/:postId', requestsRoutes); // must be before /api/posts so /request, /approve etc. match
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('auth required'));
  const decoded = verifyToken(token);
  if (!decoded?.userId) return next(new Error('invalid token'));
  socket.userId = decoded.userId;
  next();
});

io.on('connection', (socket) => {
  socket.on('chat:join', (groupId) => {
    if (groupId) socket.join(`chat:${groupId}`);
  });
  socket.on('chat:leave', (groupId) => {
    if (groupId) socket.leave(`chat:${groupId}`);
  });
  socket.on('chat:typing', ({ chatId }) => {
    if (chatId) socket.to(`chat:${chatId}`).emit('chat:typing');
  });
  socket.on('chat:stop_typing', ({ chatId }) => {
    if (chatId) socket.to(`chat:${chatId}`).emit('chat:stop_typing');
  });
});

app.on('chat:new_message', ({ groupId, message }) => {
  io.to(`chat:${groupId}`).emit('new_message', message);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AllConnect API + Socket.io listening on http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) console.warn('DATABASE_URL not set — set it in .env');
});
