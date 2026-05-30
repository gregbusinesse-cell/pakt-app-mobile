import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { USE_MOCK_DATA } from '@/lib/config';
import { supabase } from '@/lib/supabase/client';

function TabIcon({
  name,
  color,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View>
        <Ionicons name={name} size={24} color={color} />
        {badge !== undefined && badge > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -10,
              backgroundColor: Colors.red,
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 2,
              borderColor: Colors.dark100,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { profile, notificationsVersion } = useAppStore();
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Extract the user ID from profile for use in refreshNotificationCount
  useEffect(() => {
    console.log('[TAB_LAYOUT] Profile changed - id:', profile?.id);
    if (USE_MOCK_DATA) {
      setCurrentUserId('current_user');
    } else if (profile?.id) {
      setCurrentUserId(profile.id);
    }
  }, [profile?.id]);

  const refreshNotificationCount = useCallback(async (userId: string | null) => {
    console.log('[TAB_LAYOUT] refreshNotificationCount called, userId:', userId);

    if (USE_MOCK_DATA) {
      console.log('[TAB_LAYOUT] Mock mode: setting notifications to 3');
      setTotalNotifications(3);
      return;
    }

    if (!userId) {
      console.log('[TAB_LAYOUT] No user ID, setting to 0');
      setTotalNotifications(0);
      return;
    }

    try {
      // Count BOTH unviewed matches AND unviewed likes received
      const [matchesRes, likesRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .eq('is_viewed', false),
        supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('liked_id', userId)
          .eq('is_viewed', false),
      ]);

      const unviewedMatches = matchesRes.count || 0;
      const unviewedLikes = likesRes.count || 0;
      const total = unviewedMatches + unviewedLikes;

      console.log('[TAB_LAYOUT] Counts - matches:', unviewedMatches, 'likes:', unviewedLikes, 'total:', total);

      if (matchesRes.error) {
        console.error('[TAB_LAYOUT] Matches query error:', matchesRes.error);
      }
      if (likesRes.error) {
        console.error('[TAB_LAYOUT] Likes query error:', likesRes.error);
      }

      setTotalNotifications(total);
    } catch (err) {
      console.error('[TAB_LAYOUT] Exception fetching notifications:', err);
      setTotalNotifications(0);
    }
  }, []);

  // Refresh notification count when user ID or notificationsVersion changes
  useEffect(() => {
    console.log('[TAB_LAYOUT] useEffect triggered - currentUserId:', currentUserId, 'notificationsVersion:', notificationsVersion);
    refreshNotificationCount(currentUserId);
  }, [currentUserId, notificationsVersion, refreshNotificationCount]);

  // Subscribe to real-time changes on matches table
  useEffect(() => {
    if (USE_MOCK_DATA || !currentUserId) {
      console.log('[TAB_LAYOUT] Skipping subscription - mock mode or no user ID');
      return;
    }

    console.log('[TAB_LAYOUT] Setting up real-time subscription for user:', currentUserId);

    const channel = supabase
      .channel(`tab-notifs-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          console.log('[TAB_LAYOUT] Matches changed, refreshing...');
          refreshNotificationCount(currentUserId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        () => {
          console.log('[TAB_LAYOUT] Likes changed, refreshing...');
          refreshNotificationCount(currentUserId);
        }
      )
      .subscribe((status) => {
        console.log('[TAB_LAYOUT] Subscription status:', status);
      });

    // Fallback polling: refresh every 30 seconds to catch updates if subscription fails
    const pollingInterval = setInterval(() => {
      console.log('[TAB_LAYOUT] Polling notification count (fallback)...');
      refreshNotificationCount(currentUserId);
    }, 30000);

    return () => {
      console.log('[TAB_LAYOUT] Cleaning up subscription and polling');
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [currentUserId, refreshNotificationCount]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.dark100,
          borderTopColor: Colors.dark400,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Decouvrir',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matchs',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="heart"
              color={color}
              focused={focused}
              badge={totalNotifications}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Reglages',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings-sharp" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
