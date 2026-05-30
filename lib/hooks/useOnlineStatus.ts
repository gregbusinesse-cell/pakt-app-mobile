import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

function formatStatusText(lastSeenStr: string | null, online: boolean): string {
  if (!lastSeenStr) return 'Statut inconnu'
  if (online) return 'Connecté'

  try {
    const lastSeenDate = new Date(lastSeenStr)
    const distance = formatDistanceToNow(lastSeenDate, {
      locale: fr,
      addSuffix: false,
    })
    return `Hors ligne il y a ${distance}`
  } catch {
    return 'Statut inconnu'
  }
}

export function useOnlineStatus(userId: string | null) {
  const [isOnline, setIsOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string>('Chargement...')

  useEffect(() => {
    if (!userId) return

    const checkOnlineStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('last_active_at')
          .eq('id', userId)
          .single()

        if (!error && data?.last_active_at) {
          const lastActive = new Date(data.last_active_at).getTime()
          const now = new Date().getTime()
          const diffMinutes = (now - lastActive) / (1000 * 60)

          // User is online if last active within 5 minutes
          const online = diffMinutes < 5
          setIsOnline(online)
          setLastSeen(data.last_active_at)
          setStatusText(formatStatusText(data.last_active_at, online))
        }
      } catch (err) {
        console.error('Error checking online status:', err)
      }
    }

    // Check initial status
    checkOnlineStatus()

    // Set up subscription to real-time changes
    const channel = supabase
      .channel(`user-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newData = payload.new as any
          if (newData.last_active_at) {
            const lastActive = new Date(newData.last_active_at).getTime()
            const now = new Date().getTime()
            const diffMinutes = (now - lastActive) / (1000 * 60)
            const online = diffMinutes < 5
            setIsOnline(online)
            setLastSeen(newData.last_active_at)
            setStatusText(formatStatusText(newData.last_active_at, online))
          }
        }
      )
      .subscribe()

    // Poll every 15 seconds to update status
    const interval = setInterval(checkOnlineStatus, 15000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { isOnline, lastSeen, statusText }
}
