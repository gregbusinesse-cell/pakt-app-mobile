import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface NotificationCounts {
  messages: number
  matchesAndLikes: number
}

let globalRefresh: ((uid: string) => Promise<void>) | null = null

export function useNotificationCount() {
  const [counts, setCounts] = useState<NotificationCounts>({ messages: 0, matchesAndLikes: 0 })
  const [userId, setUserId] = useState<string | null>(null)

  const refresh = useCallback(async (uid: string) => {
    try {
      console.log('[useNotificationCount] Refreshing counts for user:', uid)
      const [matchesRes, likesRes, convRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
          .eq('is_viewed', false),
        supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('liked_id', uid)
          .eq('is_viewed', false),
        supabase
          .from('conversations')
          .select('id')
          .or(`user1_id.eq.${uid},user2_id.eq.${uid}`),
      ])

      const unreadMatches = matchesRes.count || 0
      const unreadLikes = likesRes.count || 0

      // Extract data from convRes (it returns { data: [...] }, not just [...])
      const conversationIds = ((convRes?.data || []) as { id: string }[]).map((c) => c.id)
      console.log('[useNotificationCount] Conversation IDs:', conversationIds)

      let unreadMessages = 0
      if (conversationIds.length > 0) {
        const { count: msgCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .neq('sender_id', uid)
          .eq('is_read', false)
        unreadMessages = msgCount || 0
      }

      console.log('[useNotificationCount] Updated counts:', {
        unreadMessages,
        unreadMatches,
        unreadLikes,
        total: unreadMessages + unreadMatches + unreadLikes,
      })

      // Set both counts separately
      setCounts({
        messages: unreadMessages,
        matchesAndLikes: unreadMatches + unreadLikes,
      })
    } catch (err) {
      console.error('[useNotificationCount] error', err)
      setCounts({ messages: 0, matchesAndLikes: 0 })
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user) {
        setUserId(null)
        setCounts({ messages: 0, matchesAndLikes: 0 })
        return
      }
      setUserId(session.user.id)
      refresh(session.user.id)
    }

    init()

    return () => {
      mounted = false
    }
  }, [refresh])

  // Store refresh function globally so it can be called from outside
  useEffect(() => {
    globalRefresh = refresh
  }, [refresh])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notif-count-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        console.log('[useNotificationCount] Matches table changed, refreshing...')
        refresh(userId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
        console.log('[useNotificationCount] Likes table changed, refreshing...')
        refresh(userId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        console.log('[useNotificationCount] Messages table changed, refreshing...')
        refresh(userId)
      })
      .subscribe((status) => {
        console.log('[useNotificationCount] Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return counts
}

// Export a function to refresh notification counts from outside the hook
export async function refreshNotificationCount(userId: string) {
  console.log('[refreshNotificationCount] Called for user:', userId, 'globalRefresh available:', !!globalRefresh)
  if (globalRefresh) {
    try {
      await globalRefresh(userId)
      console.log('[refreshNotificationCount] Refresh completed successfully')
    } catch (err) {
      console.error('[refreshNotificationCount] Error during refresh:', err)
    }
  } else {
    console.warn('[refreshNotificationCount] globalRefresh is not set, hook may not be mounted yet')
  }
}
