import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { USE_MOCK_DATA } from '@/lib/config';
import { mockCurrentUser } from '@/lib/mock-data';
import type { Profile } from '@/lib/types';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const { setUser, setProfile } = useAppStore();

  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Mode développement : charger les mock-data immédiatement
      setTimeout(() => {
        setUser({ id: 'current_user', email: 'test@example.com' });
        setProfile(mockCurrentUser as Profile);
        setLoading(false);
      }, 300);
      return;
    }

    // Mode production : charger depuis Supabase (à implémenter plus tard)
    setLoading(false);
  }, [setUser, setProfile]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.dark,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="chat/[id]"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </>
  );
}
