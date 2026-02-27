/**
 * Supabase Storage for avatar uploads.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

const BUCKET = 'avatars';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload base64 image to Supabase Storage, return public URL.
 * @param {string} userId - User ID for path
 * @param {string} base64Data - "data:image/jpeg;base64,..." or raw base64
 * @returns {Promise<string>} Public URL or null on failure
 */
async function uploadAvatar(userId, base64Data) {
  const client = getSupabase();
  if (!client) {
    console.warn('Supabase Storage not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    return null;
  }
  const match = (base64Data || '').match(/^data:image\/(\w+);base64,(.+)$/);
  const ext = match ? match[1] : 'jpeg';
  const raw = match ? match[2] : base64Data;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length > MAX_SIZE_BYTES) {
    throw new Error('Image too large (max 5MB)');
  }
  const path = `${userId}/avatar.${ext}`;
  const { data, error } = await client.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: `image/${ext}`,
      upsert: true,
    });
  if (error) {
    console.error('Supabase avatar upload error:', error);
    throw new Error('Upload failed');
  }
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData?.publicUrl || null;
}

module.exports = { uploadAvatar, getSupabase };
