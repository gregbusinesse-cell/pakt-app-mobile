import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { USE_MOCK_DATA } from '@/lib/config';

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

  const refreshNotificationCount = useCallback(async () => {
    if (USE_MOCK_DATA) {
      // Mode mock : afficher un nombre de notifications aléatoire
      setTotalNotifications(3);
      return;
    }
    // Mode production : chercher dans Supabase (à implémenter)
  }, []);

  useEffect(() => {
    refreshNotificationCount();
  }, [refreshNotificationCount, notificationsVersion]);

  // Mode mock : ignorer les abonnements Supabase en temps réel
  useEffect(() => {
    if (!USE_MOCK_DATA && profile?.id) {
      // Abonnements Supabase à implémenter en mode production
    }
  }, [profile?.id, refreshNotificationCount]);

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
