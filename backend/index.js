require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./middleware/auth');

const db = require('./db');
const { sendPushToUsers } = require('./services/notifications');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');
const requestsRoutes = require('./routes/requests');
const chatsRoutes = require('./routes/chats');
const placesRoutes = require('./routes/places');

const app = express();
const server = http.createServer(app);
const { rateLimitApiGlobal, rateLimitHealth } = require('./middleware/rateLimiter');

// Required for correct client IP when behind Render/proxy (rate limiting, etc.)
app.set('trust proxy', 1);

// Baseline security headers (API + JSON; not a substitute for WAF / TLS at the edge)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

const corsOrigin =
  process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim()
    ? process.env.CORS_ORIGIN.trim()
    : process.env.NODE_ENV === 'production'
      ? false // safer default for production (native apps don't need browser CORS)
      : true;
if (corsOrigin === false) {
  console.warn('CORS_ORIGIN not set — disabling CORS in production. If you have a web client, set CORS_ORIGIN.');
}
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: corsOrigin },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', rateLimitHealth, (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ name: 'AllConnect API', health: '/health' }));

app.use('/api', rateLimitApiGlobal);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts/:postId', requestsRoutes); // must be before /api/posts so /request, /approve etc. match
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/places', placesRoutes);

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
  socket.on('chat:join', async (groupId) => {
    if (!groupId || !socket.userId) return;
    try {
      const member = await db.row(
        `SELECT 1
         FROM group_chat_members gcm
         INNER JOIN group_chats gc ON gc.id = gcm.group_chat_id
         WHERE gcm.group_chat_id = $1 AND gcm.user_id = $2 AND gc.expires_at > NOW()`,
        [groupId, socket.userId]
      );
      if (member) socket.join(`chat:${groupId}`);
    } catch (err) {
      console.error('socket chat:join', err);
    }
  });
  socket.on('chat:leave', (groupId) => {
    if (groupId) socket.leave(`chat:${groupId}`);
  });
  socket.on('chat:typing', async ({ chatId }) => {
    if (!chatId || !socket.userId) return;
    try {
      const member = await db.row(
        `SELECT 1
         FROM group_chat_members gcm
         INNER JOIN group_chats gc ON gc.id = gcm.group_chat_id
         WHERE gcm.group_chat_id = $1 AND gcm.user_id = $2 AND gc.expires_at > NOW()`,
        [chatId, socket.userId]
      );
      if (member) socket.to(`chat:${chatId}`).emit('chat:typing');
    } catch (err) {
      console.error('socket chat:typing', err);
    }
  });
  socket.on('chat:stop_typing', async ({ chatId }) => {
    if (!chatId || !socket.userId) return;
    try {
      const member = await db.row(
        `SELECT 1
         FROM group_chat_members gcm
         INNER JOIN group_chats gc ON gc.id = gcm.group_chat_id
         WHERE gcm.group_chat_id = $1 AND gcm.user_id = $2 AND gc.expires_at > NOW()`,
        [chatId, socket.userId]
      );
      if (member) socket.to(`chat:${chatId}`).emit('chat:stop_typing');
    } catch (err) {
      console.error('socket chat:stop_typing', err);
    }
  });
});

app.on('chat:new_message', ({ groupId, message }) => {
  void (async () => {
    try {
      io.to(`chat:${groupId}`).emit('new_message', message);
      const senderId = message?.user_id;
      if (!senderId) return;
      const members = await db.rows(
        'SELECT user_id FROM group_chat_members WHERE group_chat_id = $1 AND user_id != $2',
        [groupId, senderId]
      );
      const userIds = (members || []).map((m) => m.user_id);
      if (!userIds.length) return;
      const body = (message.body || '').slice(0, 80);
      await sendPushToUsers(userIds, {
        title: 'New message',
        body: body ? `${body}${body.length >= 80 ? '…' : ''}` : 'You have a new message',
        data: { type: 'chat_message', groupId },
      });
    } catch (err) {
      console.error('chat:new_message handler', err);
    }
  })();
});

// Mark posts as expired when event_at + duration_minutes has passed (keeps History/Chat/Map consistent)
const EXPIRY_CRON_MS = 5 * 60 * 1000; // 5 minutes
function runExpiryCron() {
  db.pool.query(
    `UPDATE posts SET status = 'expired'
     WHERE status IN ('open', 'full')
       AND (event_at + (COALESCE(duration_minutes, 60) * interval '1 minute')) < NOW()`
  ).then((res) => {
    if (res.rowCount > 0) console.log(`[cron] Marked ${res.rowCount} post(s) as expired`);
  }).catch((err) => console.error('[cron] post expiry', err.message));
}
setInterval(runExpiryCron, EXPIRY_CRON_MS);
runExpiryCron();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AllConnect API + Socket.io listening on http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) console.warn('DATABASE_URL not set — set it in .env');
  const { isConfigured } = require('./services/firebase');
  if (!isConfigured()) console.warn('Firebase not configured — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH. Login will return 503.');
});
