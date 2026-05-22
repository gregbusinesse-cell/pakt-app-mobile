import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { USE_MOCK_DATA } from '@/lib/config';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Mode mock : aller directement aux tabs
      setTimeout(() => router.replace('/(tabs)'), 100);
    } else {
      // Mode production : aller à auth
      router.replace('/auth');
    }
  }, [router]);

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
