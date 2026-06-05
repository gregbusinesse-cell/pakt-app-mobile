import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import * as WebBrowser from 'expo-web-browser'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Must be called at app startup to handle OAuth deep link callbacks
WebBrowser.maybeCompleteAuthSession()

export default function RootLayout() {
  // Load Ionicons font — required for @expo/vector-icons to render in release APK
  // The font file is also declared in app.json plugins for native bundling
  const [loaded, error] = useFonts({
    'Ionicons': require('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loaded, error])

  // Don't render until fonts are ready
  if (!loaded && !error) return null

  return <Stack screenOptions={{ headerShown: false }} />
}
