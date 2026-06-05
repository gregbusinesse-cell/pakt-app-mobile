// Handles OAuth redirect callback (Google Sign-In)
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Use onAuthStateChange to wait for session to be ready (more reliable than polling)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#d4a853" />
    </View>
  )
}
