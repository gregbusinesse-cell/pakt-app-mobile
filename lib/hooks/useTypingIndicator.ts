import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useTypingIndicator(conversationId: string, userId: string | null) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!userId) return

    // Subscribe to typing status changes
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, is_typing } = payload.payload

        if (is_typing && user_id !== userId) {
          setTypingUsers((prev) => new Set([...prev, user_id]))

          // Auto-remove typing status after 3 seconds
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }

          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev)
              next.delete(user_id)
              return next
            })
          }, 3000)
        } else if (!is_typing) {
          setTypingUsers((prev) => {
            const next = new Set(prev)
            next.delete(user_id)
            return next
          })
        }
      })
      .subscribe()

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [conversationId, userId])

  const broadcastTyping = (isTyping: boolean) => {
    if (!userId) return

    supabase.channel(`typing-${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: userId,
        is_typing: isTyping,
      },
    })
  }

  return { typingUsers, broadcastTyping }
}
