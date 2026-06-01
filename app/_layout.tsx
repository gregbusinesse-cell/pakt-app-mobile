import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import Ionicons from '@expo/vector-icons/Ionicons'

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  // Explicitly load Ionicons font so icons show in release APK builds
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  // Wait for fonts before rendering
  if (!fontsLoaded && !fontError) {
    return null
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
