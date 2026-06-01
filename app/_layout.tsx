import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

// Load ALL icon fonts from @expo/vector-icons so icons show in release APK
const IoniconsTTF = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Ionicons': IoniconsTTF,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
