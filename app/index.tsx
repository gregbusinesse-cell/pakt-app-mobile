import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { supabase } from '@/lib/supabase/client'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/(app)/swipe' as any)
      } else {
        router.replace('/auth' as any)
      }
    })
  }, [])

  return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
}
