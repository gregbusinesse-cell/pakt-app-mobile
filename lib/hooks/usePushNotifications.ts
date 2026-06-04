import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'expo-router'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const router = useRouter()
  const notifListener = useRef<any>(null)
  const responseListener = useRef<any>(null)

  useEffect(() => {
    // Auto-register silently on mount (no custom dialog, just system prompt)
    registerForPushNotifications()

    notifListener.current = Notifications.addNotificationReceivedListener(n => {
      console.log('[PUSH] Received:', n.request.content.title)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(r => {
      const data = r.notification.request.content.data as any
      if (data?.type === 'match' || data?.type === 'like') router.push('/(app)/matches' as any)
      else if (data?.type === 'message' && data?.conversation_id) router.push(('/messages/' + data.conversation_id) as any)
    })

    return () => {
      if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current)
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [])
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null

  // Android notification channel (no dialog needed)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'PAKT',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#d4a853',
    })
  }

  // Request permission (iOS: shows system dialog once; Android 13+: shows once)
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') {
    console.log('[PUSH] Permission not granted')
    return null
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: '9f4670fe-2401-4e85-905f-38368ff7edca',
    })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id && token) {
      await supabase.from('profiles').update({ push_token: token } as any).eq('id', session.user.id)
      console.log('[PUSH] Token registered:', token.substring(0, 20) + '...')
    }
    return token
  } catch (e) {
    console.error('[PUSH] Token error:', e)
    return null
  }
}
