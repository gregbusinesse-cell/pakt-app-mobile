import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface MatchItem {
  id: string
  otherUser: Profile
  conversationId: string | null
  createdAt: string | null
  isViewed: boolean
}

interface LikeItem {
  id: string
  likeId: string
  otherUser: Profile
  createdAt: string | null
  isViewed: boolean
}

interface ConversationItem {
  id: string
  otherUser: Profile
  lastMessage: string | null
  lastMessageAt: string | null
}

export function useMatches() {
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [likes, setLikes] = useState<LikeItem[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setMatches([])
        setLikes([])
        setConversations([])
        setError(null)
        setLoading(false)
        return
      }

      const currentUserId = session.user.id

      // Fetch conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })

      if (conversationsError) throw conversationsError

      // Fetch matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })

      if (matchesError) throw matchesError

      // Fetch likes received
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('*')
        .eq('liked_id', currentUserId)
        .order('created_at', { ascending: false })

      if (likesError) throw likesError

      // Get all user IDs we need to fetch profiles for
      const userIds = new Set<string>()

      matchesData?.forEach((m: any) => {
        userIds.add(m.user1_id === currentUserId ? m.user2_id : m.user1_id)
      })

      likesData?.forEach((l: any) => {
        userIds.add(l.liker_id)
      })

      conversationsData?.forEach((c: any) => {
        userIds.add(c.user1_id === currentUserId ? c.user2_id : c.user1_id)
      })

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(userIds))

      if (profilesError) throw profilesError

      const profileMap = new Map(profilesData?.map((p: Profile) => [p.id, p]) || [])

      // Build match items
      const matchItems: MatchItem[] = (matchesData || [])
        .map((m: any) => {
          const otherUserId = m.user1_id === currentUserId ? m.user2_id : m.user1_id
          const otherUser = profileMap.get(otherUserId)

          return {
            id: m.id,
            otherUser: otherUser || ({} as Profile),
            conversationId: (conversationsData || []).find(
              (c: any) =>
                (c.user1_id === currentUserId && c.user2_id === otherUserId) ||
                (c.user2_id === currentUserId && c.user1_id === otherUserId)
            )?.id || null,
            createdAt: m.created_at,
            isViewed: m.is_viewed || false,
          }
        })
        .filter((m) => m.otherUser.id)

      // Build like items, filtering out likes where a match already exists
      const matchUserIds = new Set<string>()
      matchItems.forEach((m) => {
        matchUserIds.add(m.otherUser.id)
      })

      const likeItems: LikeItem[] = (likesData || [])
        .map((l: any) => {
          const otherUser = profileMap.get(l.liker_id)

          return {
            id: l.liker_id,
            likeId: l.id,
            otherUser: otherUser || ({} as Profile),
            createdAt: l.created_at,
            isViewed: l.is_viewed || false,
          }
        })
        .filter((l) => l.otherUser.id)
        // Don't show likes from people we're already matched with
        .filter((l) => !matchUserIds.has(l.otherUser.id))

      // Build conversation items
      const conversationItems: ConversationItem[] = (conversationsData || [])
        .map((c: any) => {
          const otherUserId = c.user1_id === currentUserId ? c.user2_id : c.user1_id
          const otherUser = profileMap.get(otherUserId)

          return {
            id: c.id,
            otherUser: otherUser || ({} as Profile),
            lastMessage: null,
            lastMessageAt: c.created_at,
          }
        })
        .filter((c) => c.otherUser.id)

      setMatches(matchItems)
      setLikes(likeItems)
      setConversations(conversationItems)
      setError(null)
    } catch (err) {
      console.error('Error loading matches:', err)
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Set up real-time subscriptions
    const channel = supabase
      .channel('matches-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { matches, likes, conversations, loading, error, reload: loadData }
}
