import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { supabase } from '@/lib/supabase/client'
import { profileStore } from '@/lib/profileStore'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useCurrentUser() {
  // Initialiser depuis le store global si déjà chargé
  const [profile, setProfile] = useState<Profile | null>(profileStore.profile)
  const [loading, setLoading] = useState(profileStore.profile === null)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedOnce = useRef(profileStore.profile !== null)

  const fetchCurrentUser = useCallback(async () => {
    try {
      if (!hasLoadedOnce.current) setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        profileStore.set(null)
        hasLoadedOnce.current = false
        setLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      hasLoadedOnce.current = true
      // Mettre à jour le store global — tous les abonnés reçoivent la mise à jour
      profileStore.set(profileData)
      setError(null)
    } catch (err) {
      console.error('[useCurrentUser] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  // Refetch when app comes back to foreground (e.g., plan changed in Supabase)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchCurrentUser()
      }
    })
    return () => subscription.remove()
  }, [fetchCurrentUser])

  // S'abonner au store global pour recevoir les mises à jour
  useEffect(() => {
    const unsubscribe = profileStore.subscribe((p) => {
      setProfile(p)
    })
    return unsubscribe
  }, [])

  return { profile, loading, error, refetch: fetchCurrentUser }
}
