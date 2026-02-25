// Shapes match PostgreSQL backend (snake_case from API)
export interface User {
  id: string;
  mobile: string;
  name?: string | null;
  email?: string | null;
  /** Data URI (e.g. data:image/jpeg;base64,...) or file URI for profile picture. Stored locally until backend supports upload. */
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
  host_id?: string;
  title: string;
  description?: string | null;
  category: PostCategory | string;
  lat: number;
  lng: number;
  address_text?: string | null;
  event_at: string;
  duration_minutes?: number;
  cost_per_person?: number;
  max_people: number;
  status: string;
  created_at?: string;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export interface GroupChat {
  id: string;
  post_id: string;
  title?: string;
  category?: string;
  event_at?: string;
  expires_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}
