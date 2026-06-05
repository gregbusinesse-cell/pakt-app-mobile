// Handles OAuth redirect callback (Google Sign-In)
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      // Session may take time to be set after OAuth redirect
      // Wait and retry if session not immediately available
      for (let i = 0; i < 10; i++) {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user?.id) {
          // Session is ready! Check onboarding status
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', session.user.id)
            .single()

          if (profile?.is_onboarded) {
            router.replace('/(app)/swipe' as any)
          } else {
            router.replace('/onboarding' as any)
          }
          return
        }

        // Wait before retrying
        await new Promise(r => setTimeout(r, 300))
      }

      // Session never became available, return to auth
      console.warn('[AUTH_CALLBACK] Session not available after retries, returning to auth')
      router.replace('/auth' as any)
    }

    handleCallback()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#d4a853" />
    </View>
  )
}
