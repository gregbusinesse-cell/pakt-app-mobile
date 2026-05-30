export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  age: number | null;
  bio: string | null;
  city: string | null;
  city_lat: number | null;
  city_lng: number | null;
  interests: string[];
  photos: string[];
  skills: Json | null;
  preferences: Json | null;
  plan: 'free' | 'business' | 'business_pro' | 'premium';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_plan: 'free' | 'business' | 'business_pro' | null;
  swipes_today: number;
  messages_today: number;
  likes_today: number;
  last_swipe_date: string | null;
  last_message_date: string | null;
  last_like_date: string | null;
  is_onboarded: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  email_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  is_viewed: boolean;
}

export interface Like {
  id: string;
  liker_id: string;
  liked_id: string;
  created_at: string;
  is_viewed: boolean;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  match_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  conversation_type: 'match' | 'direct';
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'audio' | 'file' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_read: boolean;
  created_at: string;
}

export type PlanKey = 'free' | 'business' | 'business_pro';

export interface UserSkill {
  name: string;
  level: number;
  comment?: string;
}

export interface SkillFilter {
  name: string;
  min_level: number;
}

export interface Preferences {
  distance_km: number;
  age_min: number;
  age_max: number;
  skill_filters?: SkillFilter[];
}
