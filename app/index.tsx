import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/(app)/swipe')
  }, [])

  return <View style={{ flex: 1 }} />
}
