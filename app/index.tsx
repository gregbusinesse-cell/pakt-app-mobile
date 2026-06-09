import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { supabase } from '@/lib/supabase/client'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/auth' as any)
        return
      }
      // Check if onboarding is complete
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
    })
  }, [])

  return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
}
