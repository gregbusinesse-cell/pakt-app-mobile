import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface NotificationCounts {
  messages: number
  matchesAndLikes: number
}

export function useNotificationCount() {
  const [counts, setCounts] = useState<NotificationCounts>({ messages: 0, matchesAndLikes: 0 })
  const [userId, setUserId] = useState<string | null>(null)

  const refresh = useCallback(async (uid: string) => {
    try {
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

      const conversationIds = ((convRes.data || []) as { id: string }[]).map((c) => c.id)

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

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notif-count-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => refresh(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refresh(userId))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return counts
}
