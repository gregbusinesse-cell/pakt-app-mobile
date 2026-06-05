import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { setPendingOAuthUrl } from '@/lib/oauthPending'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Ionicons': require('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loaded, error])

  useEffect(() => {
    // Capture l'URL OAuth ICI, avant qu'Expo Router navigue vers auth/callback
    // _layout est TOUJOURS monté → pas de timing issue
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('auth/callback')) {
        console.log('[LAYOUT] OAuth URL capturée:', url.substring(0, 80))
        setPendingOAuthUrl(url)
      }
    })

    // Aussi capturer si l'app a été ouverte depuis un deep link (état tué)
    Linking.getInitialURL().then(url => {
      if (url && url.includes('auth/callback')) {
        setPendingOAuthUrl(url)
      }
    })

    return () => sub.remove()
  }, [])

  if (!loaded && !error) return null

  return <Stack screenOptions={{ headerShown: false }} />
}
