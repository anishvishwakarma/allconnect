/**
 * Seed demo data for AllConnect (real data for map + flows).
 * Run after migrate: node src/db/seed.js
 * Safe to run multiple times: only inserts if no posts exist.
 */
import 'dotenv/config';
import { query } from './client.js';

const DELHI = { lat: 28.6139, lng: 77.209 };
const OFFSET = 0.01; // ~1km

async function seed() {
  const { rows: existing } = await query('SELECT 1 FROM posts LIMIT 1');
  if (existing.length > 0) {
    console.log('Posts already exist. Skip seed.');
    return;
  }

  const mobiles = ['+919876543210', '+919876543211', '+919876543212'];
  const names = ['Alex', 'Sam', 'Jordan'];
  const emails = ['alex@example.com', 'sam@example.com', 'jordan@example.com'];
  const users = [];
  for (let i = 0; i < mobiles.length; i++) {
    const { rows } = await query(
      `INSERT INTO users (mobile, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name RETURNING id, mobile, name`,
      [mobiles[i], names[i], emails[i]]
    );
    users.push(rows[0]);
  }
  const [u1, u2, u3] = users;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const posts = [
    { user_id: u1.id, title: 'Evening jog at India Gate', category: 'activity', lat: DELHI.lat, lng: DELHI.lng, event_at: tomorrow, address_text: 'India Gate, New Delhi', max_people: 4, cost: 0 },
    { user_id: u1.id, title: 'Coffee chat this weekend', category: 'meetup', lat: DELHI.lat + OFFSET, lng: DELHI.lng, event_at: dayAfter, address_text: 'Connaught Place', max_people: 6, cost: 200 },
    { user_id: u2.id, title: 'Cricket at Nehru Park', category: 'activity', lat: DELHI.lat - OFFSET * 0.5, lng: DELHI.lng + OFFSET, event_at: tomorrow, address_text: 'Nehru Park', max_people: 12, cost: 0 },
    { user_id: u2.id, title: 'Sell old books', category: 'selling', lat: DELHI.lat + OFFSET * 0.3, lng: DELHI.lng - OFFSET * 0.5, event_at: dayAfter, address_text: 'Khan Market', max_people: 2, cost: 0 },
    { user_id: u3.id, title: 'Study group for exams', category: 'study', lat: DELHI.lat - OFFSET, lng: DELHI.lng, event_at: dayAfter, address_text: 'Central Library', max_people: 8, cost: 0 },
    { user_id: u3.id, title: 'Weekend trek planning', category: 'event', lat: DELHI.lat + OFFSET * 1.2, lng: DELHI.lng + OFFSET * 0.8, event_at: dayAfter, address_text: 'Online then meet', max_people: 5, cost: 500 },
  ];

  for (const p of posts) {
    await query(
      `INSERT INTO posts (user_id, title, category, description, location, address_text, event_at, duration_minutes, cost_per_person, max_people, status)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, 60, $9, $10, 'open')`,
      [p.user_id, p.title, p.category, `Join me for ${p.title.toLowerCase()}.`, p.lng, p.lat, p.address_text, p.event_at, p.cost, p.max_people]
    );
  }

  console.log('Seed done: 3 users, 6 posts (real geo around Delhi).');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
