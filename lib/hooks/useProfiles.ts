import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

const VIEW_COOLDOWN_DAYS = 14

function deterministicShuffle(items: Profile[], seed: string): Profile[] {
  const hashed = items.map((p) => {
    let h = 0
    const key = seed + p.id
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0
    }
    return { profile: p, hash: h }
  })
  hashed.sort((a, b) => a.hash - b.hash)
  return hashed.map((h) => h.profile)
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function useProfiles(userProfile?: Profile) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true)

        // Get current user session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          setProfiles([])
          setError(null)
          setLoading(false)
          return
        }

        const sessionUserId = session.user.id

        // Fetch all needed data in parallel
        const [swipedResult, viewsResult, blockedByMeResult, blockedMeResult, profilesResult] =
          await Promise.all([
            supabase.from('swipes').select('target_id').eq('swiper_id', sessionUserId),
            supabase
              .from('profile_views')
              .select('viewed_id')
              .eq('viewer_id', sessionUserId)
              .gte('last_viewed_at', new Date(Date.now() - VIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()),
            supabase.from('blocked_users').select('blocked_id').eq('blocker_id', sessionUserId),
            supabase.from('blocked_users').select('blocker_id').eq('blocked_id', sessionUserId),
            supabase
              .from('profiles')
              .select('*')
              .eq('is_onboarded', true)
              .eq('is_suspended', false)
              .eq('email_confirmed', true)
              .neq('id', sessionUserId)
              .order('id', { ascending: true })
              .limit(200),
          ])

        const swipedIds = new Set(swipedResult.data?.map((row: any) => row.target_id) || [])
        const viewedIds = new Set(viewsResult.data?.map((row: any) => row.viewed_id) || [])
        const blockedByMeIds = new Set(blockedByMeResult.data?.map((row: any) => row.blocked_id) || [])
        const blockedMeIds = new Set(blockedMeResult.data?.map((row: any) => row.blocker_id) || [])

        if (profilesResult.error) throw profilesResult.error

        // Filter profiles
        let filtered = (profilesResult.data || []).filter((profile) => {
          if (blockedByMeIds.has(profile.id) || blockedMeIds.has(profile.id)) return false
          return true
        })

        // Apply distance and age filtering if user has location
        if (userProfile?.city_lat && userProfile?.city_lng) {
          const maxDistance = 1000 // Default 1000km
          const ageMin = 18
          const ageMax = 99

          filtered = filtered.filter((p) => {
            if (p.age && (p.age < ageMin || p.age > ageMax)) return false
            if (p.city_lat && p.city_lng) {
              const dist = calculateDistance(
                userProfile.city_lat as number,
                userProfile.city_lng as number,
                p.city_lat as number,
                p.city_lng as number
              )
              if (dist > maxDistance) return false
            }
            return true
          })
        }

        // Shuffle deterministically
        const todayKey = new Date().toISOString().split('T')[0]
        const shuffled = deterministicShuffle(filtered, todayKey)

        // Sort: swipped/viewed at end, then by shuffle order
        const sorted = shuffled.sort((a, b) => {
          const aViewed = swipedIds.has(a.id) || viewedIds.has(a.id)
          const bViewed = swipedIds.has(b.id) || viewedIds.has(b.id)
          if (aViewed === bViewed) return 0
          return aViewed ? 1 : -1
        })

        setProfiles(sorted)
        setError(null)
      } catch (err) {
        console.error('Error fetching profiles:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch profiles')
      } finally {
        setLoading(false)
      }
    }

    fetchProfiles()
  }, [userProfile])

  return { profiles, loading, error }
}
