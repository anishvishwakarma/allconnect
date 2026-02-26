-- AllConnect backend — run once: psql $DATABASE_URL -f schema.sql
-- gen_random_uuid() is built-in in Postgres 13+ (Supabase uses Postgres 15)

-- Users (created on first verify-otp)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  avatar_uri TEXT,
  kyc_verified BOOLEAN DEFAULT FALSE,
  posts_this_month INT DEFAULT 0,
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- OTP codes (TTL ~10 min)
CREATE TABLE IF NOT EXISTS otp_codes (
  mobile TEXT NOT NULL PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address_text TEXT,
  event_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  cost_per_person NUMERIC(10,2),
  max_people INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  privacy_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_host ON posts(host_id);
CREATE INDEX IF NOT EXISTS idx_posts_event_at ON posts(event_at);
CREATE INDEX IF NOT EXISTS idx_posts_lat_lng ON posts(lat, lng);

-- Join requests (one per user per post)
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_post ON join_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);

-- Group chats (one per post, created when first request approved)
CREATE TABLE IF NOT EXISTS group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  event_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_chats_post ON group_chats(post_id);

-- Group chat members
CREATE TABLE IF NOT EXISTS group_chat_members (
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_chat_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_chat_id);

-- History: track which user joined which post (for /api/posts/history/list)
CREATE TABLE IF NOT EXISTS post_participations (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_participations_user ON post_participations(user_id);
