import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { setPendingOAuthUrl } from '@/lib/oauthPending'
import { supabase } from '@/lib/supabase/client'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const router = useRouter()

  const [loaded, error] = useFonts({
    'Ionicons': require('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loaded, error])

  useEffect(() => {
    // ─── Capture l'URL OAuth avant qu'Expo Router navigue ───────────────────
    // _layout est TOUJOURS monté → pas de timing issue
    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('auth/callback')) {
        console.log('[LAYOUT] OAuth URL capturée:', url.substring(0, 80))
        setPendingOAuthUrl(url)
      }
    })

    Linking.getInitialURL().then(url => {
      if (url && url.includes('auth/callback')) {
        setPendingOAuthUrl(url)
      }
    })

    // ─── onAuthStateChange au niveau ROOT ────────────────────────────────────
    // auth.tsx est DÉMONTÉ quand Expo Router navigue vers auth/callback
    // → son subscriber est désinscrit → plus de redirection
    // En mettant le subscriber ici (_layout jamais démonté), la redirection
    // fonctionne même quand auth.tsx n'est plus dans la stack
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[LAYOUT] Auth event:', event, session?.user?.id ?? 'no user')

        if (event === 'SIGNED_IN' && session?.user?.id) {
          const userId = session.user.id
          const accessToken = session.access_token

          // setTimeout(0) libère le lock Supabase AVANT de faire la requête DB
          // Sans ça: setSession tient le lock → requête DB attend le lock → deadlock
          setTimeout(async () => {
            console.log('[LAYOUT] Fetching profile for:', userId)
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('is_onboarded')
              .eq('id', userId)
              .single()

            console.log('[LAYOUT] Profile result:', profile?.is_onboarded, error?.message)

            if (profile?.is_onboarded) {
              router.replace('/(app)/swipe' as any)
            } else {
              router.replace('/onboarding' as any)
            }
          }, 0)
        }
      }
    )

    return () => {
      linkingSub.remove()
      authSub.unsubscribe()
    }
  }, [])

  if (!loaded && !error) return null

  return <Stack screenOptions={{ headerShown: false }} />
}
