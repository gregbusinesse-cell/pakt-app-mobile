import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase/client'

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  useEffect(() => {
    let subscription: Notifications.Subscription

    const setupNotifications = async () => {
      try {
        // Get notification permission
        const { status } = await Notifications.requestPermissionsAsync()

        if (status !== 'granted') {
          console.log('Notification permission not granted')
          return
        }

        // Get Expo push token
        const token = await Notifications.getExpoPushTokenAsync()
        console.log('Push token:', token.data)

        // TODO: Send push token to backend to store in user profile
        // This would be saved in a push_tokens table or notification_settings

        // Handle notifications when app is in foreground
        subscription = Notifications.addNotificationReceivedListener((notification) => {
          console.log('Notification received:', notification)
          // Handle in-app notification UI if needed
        })

        // Handle notification responses (when user taps notification)
        const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          console.log('Notification response:', response)
          // Navigate to relevant screen based on notification data
          const { data } = response.notification.request.content

          if (data?.type === 'like') {
            // Navigate to matches
          } else if (data?.type === 'match') {
            // Navigate to matches
          } else if (data?.type === 'message') {
            // Navigate to messages
          }
        })

        return () => {
          subscription.remove()
          responseSubscription.remove()
        }
      } catch (err) {
        console.error('Error setting up notifications:', err)
      }
    }

    setupNotifications()
  }, [])
}

// Function to send notifications (called from API/Supabase)
export async function sendNotification(
  userId: string,
  type: 'like' | 'match' | 'message',
  title: string,
  body: string,
  data?: any
) {
  try {
    // This would be called from your backend
    // For now, we're preparing the structure for when push tokens are saved

    console.log('Notification prepared:', { userId, type, title, body, data })

    // In production, you would:
    // 1. Get the user's push token from database
    // 2. Send via Expo Push Notification Service
    // 3. Or use native iOS/Android push services

    // Expo Push API endpoint would be something like:
    // POST https://exp.host/--/api/v2/push/send
    // {
    //   "to": "ExponentPushToken[...]",
    //   "sound": "default",
    //   "title": title,
    //   "body": body,
    //   "data": { type, ...data }
    // }
  } catch (err) {
    console.error('Error sending notification:', err)
  }
}

// Listen to real-time database changes and trigger notifications
export async function setupNotificationTriggers(userId: string) {
  try {
    // Listen to new likes
    const likesChannel = supabase
      .channel(`likes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `liked_id=eq.${userId}`,
        },
        async (payload) => {
          const like = payload.new as any
          // Fetch liker's name
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', like.liker_id)
            .single()

          console.log('New like notification trigger:', {
            title: 'Nouveau like!',
            body: `${profile?.first_name || 'Quelqu\'un'} vous a aimé`,
            type: 'like',
            likerId: like.liker_id,
          })
        }
      )
      .subscribe()

    // Listen to new matches
    const matchesChannel = supabase
      .channel(`matches-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `or(user1_id.eq.${userId},user2_id.eq.${userId})`,
        },
        async (payload) => {
          const match = payload.new as any
          const matchUserId = match.user1_id === userId ? match.user2_id : match.user1_id

          // Fetch matched user's name
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', matchUserId)
            .single()

          console.log('New match notification trigger:', {
            title: 'Nouveau match!',
            body: `Vous avez matché avec ${profile?.first_name || 'quelqu\'un'}`,
            type: 'match',
            matchId: match.id,
          })
        }
      )
      .subscribe()

    // Listen to new messages
    const messagesChannel = supabase
      .channel(`messages-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id.neq.${userId}`,
        },
        async (payload) => {
          const message = payload.new as any

          // Fetch sender's name and get conversation
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', message.sender_id)
            .single()

          // Check if sender is in conversation with user
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', message.conversation_id)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .single()

          if (conv) {
            console.log('New message notification trigger:', {
              title: `Message de ${profile?.first_name || 'quelqu\'un'}`,
              body: message.content || '(Fichier ou média)',
              type: 'message',
              conversationId: message.conversation_id,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(likesChannel)
      supabase.removeChannel(matchesChannel)
      supabase.removeChannel(messagesChannel)
    }
  } catch (err) {
    console.error('Error setting up notification triggers:', err)
  }
}
