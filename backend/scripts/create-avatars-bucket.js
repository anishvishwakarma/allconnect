/**
 * Creates the 'avatars' bucket in Supabase Storage.
 * Run: node scripts/create-avatars-bucket.js
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'avatars';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  let data, error;
  try {
    const result = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
    });
    data = result.data;
    error = result.error;
  } catch (err) {
    console.error('Fetch/network error:', err.message || err);
    console.error('Tip: Check internet, VPN, firewall. SUPABASE_URL:', url);
    process.exit(1);
  }
  if (error) {
    if (error.message?.includes('already exists')) {
      console.log(`Bucket "${BUCKET}" already exists. OK.`);
      return;
    }
    console.error('Error creating bucket:', error.message);
    process.exit(1);
  }
  console.log(`Bucket "${BUCKET}" created successfully.`);
}

main();
