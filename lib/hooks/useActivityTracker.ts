import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useActivityTracker() {
  useEffect(() => {
    const updateActivity = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        // Update last_active_at timestamp
        await supabase
          .from('profiles')
          .update({
            last_active_at: new Date().toISOString(),
          })
          .eq('id', session.user.id)
      } catch (err) {
        console.error('Error updating activity:', err)
      }
    }

    // Update activity on mount
    updateActivity()

    // Update activity every 15 seconds
    const interval = setInterval(updateActivity, 15000)

    return () => clearInterval(interval)
  }, [])
}
