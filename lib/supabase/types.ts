export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          age: number | null;
          bio: string | null;
          city: string | null;
          city_lat: number | null;
          city_lng: number | null;
          interests: string[] | null;
          photos: string[] | null;
          skills: any | null;
          preferences: any | null;
          plan?: string | null; // Legacy field, kept for backward compatibility
          subscription_plan: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          swipes_today: number | null;
          messages_today: number | null;
          likes_today: number | null;
          last_swipe_date: string | null;
          last_message_date: string | null;
          last_like_date: string | null;
          last_active_at: string | null;
          is_onboarded: boolean | null;
          is_suspended: boolean | null;
          suspension_reason: string | null;
          email_confirmed: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      messages: {
        Row: {
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
        };
        Insert: Partial<Database['public']['Tables']['messages']['Row']>;
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
      };
      conversations: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          match_id: string | null;
          last_message: string | null;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['conversations']['Row']>;
        Update: Partial<Database['public']['Tables']['conversations']['Row']>;
      };
      blocked_users: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['blocked_users']['Row']>;
        Update: Partial<Database['public']['Tables']['blocked_users']['Row']>;
      };
      encouragements: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          target_id: string;
          message: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['encouragements']['Row']>;
        Update: Partial<Database['public']['Tables']['encouragements']['Row']>;
      };
    };
  };
};
