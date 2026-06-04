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
      // Session is automatically handled by Supabase client
      // Just wait a moment then redirect
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Check onboarding status
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
      } else {
        router.replace('/auth' as any)
      }
    }

    handleCallback()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#d4a853" />
    </View>
  )
}
