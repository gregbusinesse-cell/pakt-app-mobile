import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type ConversationRow = Database['public']['Tables']['conversations']['Row']

interface Conversation extends ConversationRow {
  participant: Profile | null
  last_message: string | null
  updated_at: string
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

        // Fetch last message for each conversation
        const { data: messagesData, error: messageError } = await supabase
          .from('messages')
          .select('conversation_id, content, message_type')
          .in('conversation_id', conversationsData.map((c: any) => c.id))
          .order('created_at', { ascending: false })

        if (messageError) throw messageError

        const lastMessageMap = new Map<string, { content: string; message_type: string }>()
        messagesData?.forEach((msg: any) => {
          if (!lastMessageMap.has(msg.conversation_id)) {
            lastMessageMap.set(msg.conversation_id, {
              content: msg.content,
              message_type: msg.message_type,
            })
          }
        })

        // Build conversation items
        const items: Conversation[] = conversationsData.map((conv: any) => {
          const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          const lastMsg = lastMessageMap.get(conv.id)
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
            updated_at: conv.created_at,
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

    fetchConversations()

    // Set up real-time subscription
    const channel = supabase
      .channel('conversations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { conversations, loading, error }
}
