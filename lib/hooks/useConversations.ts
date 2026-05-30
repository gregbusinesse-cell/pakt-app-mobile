import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type ConversationRow = Database['public']['Tables']['conversations']['Row']

interface Conversation extends ConversationRow {
  participant: Profile | null
  last_message: string | null
  updated_at: string
  unreadCount: number
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current user session
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          setConversations([])
          setLoading(false)
          return
        }

        const userId = session.user.id

        // Get conversations for current user
        const { data: conversationsData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (convError) throw convError

        if (!conversationsData || conversationsData.length === 0) {
          setConversations([])
          return
        }

        // Get all participant IDs
        const participantIds = new Set<string>()
        conversationsData.forEach((conv: any) => {
          const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          participantIds.add(otherUserId)
        })

        // Fetch all participant profiles
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(participantIds))

        if (profileError) throw profileError

        const profileMap = new Map(profilesData?.map((p: Profile) => [p.id, p]) || [])

        // Fetch last message and count unread messages for each conversation
        const { data: messagesData, error: messageError } = await supabase
          .from('messages')
          .select('conversation_id, content, message_type, sender_id, is_read')
          .in('conversation_id', conversationsData.map((c: any) => c.id))
          .order('created_at', { ascending: false })

        if (messageError) throw messageError

        const lastMessageMap = new Map<string, { content: string; message_type: string; created_at: string }>()
        const unreadCountMap = new Map<string, number>()

        // Initialize unread counts
        conversationsData.forEach((c: any) => {
          unreadCountMap.set(c.id, 0)
        })

        messagesData?.forEach((msg: any) => {
          // Track last message
          if (!lastMessageMap.has(msg.conversation_id)) {
            lastMessageMap.set(msg.conversation_id, {
              content: msg.content,
              message_type: msg.message_type,
              created_at: msg.created_at,
            })
          }

          // Count unread messages (not sent by current user and not read)
          if (msg.sender_id !== userId && !msg.is_read) {
            const current = unreadCountMap.get(msg.conversation_id) || 0
            unreadCountMap.set(msg.conversation_id, current + 1)
          }
        })

        // Build conversation items
        const items: Conversation[] = conversationsData.map((conv: any) => {
          const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          const lastMsg = lastMessageMap.get(conv.id)
          const unreadCount = unreadCountMap.get(conv.id) || 0
          let lastMessage: string | null = null

          if (lastMsg) {
            if (lastMsg.message_type === 'audio') lastMessage = 'Vocal'
            else if (lastMsg.message_type === 'image') lastMessage = 'Photo'
            else if (lastMsg.message_type === 'file') lastMessage = 'Fichier'
            else lastMessage = lastMsg.content || 'Message vide'
          }

          return {
            ...conv,
            participant: profileMap.get(otherUserId) || null,
            last_message: lastMessage,
            updated_at: lastMsg?.created_at || conv.created_at,
            unreadCount,
          }
        })

        setConversations(items)
        setError(null)
      } catch (err) {
        console.error('Error fetching conversations:', err)
        setError(err instanceof Error ? err.message : 'Erreur chargement conversations')
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    fetchConversations()

    // Store the fetch function globally so it can be called from outside
    setReloadConversationsFunction(fetchConversations)

    // Set up real-time subscription
    const channel = supabase
      .channel('conversations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        console.log('[useConversations] Conversations changed, reloading...')
        fetchConversations()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        console.log('[useConversations] Messages changed, reloading...')
        fetchConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { conversations, loading, error, reload: fetchConversations }
}

// Global variable to store the reload function
let globalReloadConversations: (() => Promise<void>) | null = null

// Store the reload function globally so it can be called from outside the hook
export function setReloadConversationsFunction(fn: () => Promise<void>) {
  globalReloadConversations = fn
}

// Export a function to reload conversations from outside the hook
export async function reloadConversationsList() {
  console.log('[reloadConversationsList] Called, globalReloadConversations available:', !!globalReloadConversations)
  if (globalReloadConversations) {
    try {
      await globalReloadConversations()
      console.log('[reloadConversationsList] Reload completed successfully')
    } catch (err) {
      console.error('[reloadConversationsList] Error during reload:', err)
    }
  } else {
    console.warn('[reloadConversationsList] globalReloadConversations is not set, hook may not be mounted yet')
  }
}
