// Shapes match Supabase/PostgreSQL backend API responses (snake_case)
export interface User {
  id: string;
  mobile: string;
  name?: string | null;
  email?: string | null;
  avatar_uri?: string | null;
  kyc_verified?: boolean;
  posts_this_month: number;
  subscription_ends_at?: string | null;
}

export const POST_CATEGORIES = [
  'activity', 'need', 'selling', 'meetup',
  'event', 'study', 'nightlife', 'other',
] as const;

export type PostCategory = typeof POST_CATEGORIES[number];

export interface Post {
  id: string;
  host_id?: string | null;
  title: string;
  description?: string | null;
  category: PostCategory | string;
  lat: number;
  lng: number;
  address_text?: string | null;
  event_at: string;
  duration_minutes?: number;
  cost_per_person?: number | null;
  max_people: number;
  status: string;
  privacy_type?: string | null;
  created_at?: string;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_mobile?: string | null;
  status: string;
  created_at: string;
}

export interface GroupChat {
  id: string;
  post_id?: string | null;
  title?: string;
  category?: string | null;
  event_at?: string | null;
  expires_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  user_name?: string | null;
  body: string;
  created_at: string;
}
