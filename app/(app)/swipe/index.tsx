import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import { ProfileImage } from '@/components/ProfileImage'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

const { width: SW } = Dimensions.get('window')
const PHOTO_HEIGHT = Math.min(400, Math.round((SW - 32) * 1.25))

const LEVEL_LABELS: Record<number, string> = {
  1: 'Débutant', 2: 'Débutant', 3: 'Débutant +',
  4: 'Intermédiaire', 5: 'Intermédiaire', 6: 'Intermédiaire +',
  7: 'Avancé', 8: 'Avancé', 9: 'Expert', 10: 'Expert',
}

export default function SwipePage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showUndoPaywall, setShowUndoPaywall] = useState(false)
  const [lastSwiped, setLastSwiped] = useState<{ profile: Profile; dir: 'left' | 'right' } | null>(null)

  // Animations
  const cardScaleAnim = useRef(new Animated.Value(1)).current

  // ── 1. GET SESSION ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user?.id) {
        router.replace('/auth' as any)
        return
      }

      const uid = data.session.user.id
      setUserId(uid)

      // check plan
      const { data: prof } = await supabase
        .from('profiles')
        .select('plan, subscription_plan')
        .eq('id', uid)
        .single()

      const plan = (prof?.subscription_plan || prof?.plan || '').toLowerCase()
      setIsPro(plan === 'business_pro')
    })
  }, [])

  // ── 2. LOAD PROFILES ────────────────────────────────────────
  const loadProfiles = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    try {
      // Load user preferences for filtering (Business Pro only)
      const { data: userPrefs } = await supabase
        .from('profiles')
        .select('subscription_plan, min_age, max_age, max_distance_km, preferred_skills, lat, lon')
        .eq('id', userId)
        .single()

      const plan = (userPrefs?.subscription_plan || '').toLowerCase()
      const isBusinessPro = plan === 'business_pro'

      // Get already swiped IDs (must never show these again)
      const { data: swiped } = await supabase
        .from('swipes')
        .select('target_id')
        .eq('swiper_id', userId)

      const swipedIds = new Set<string>([
        userId,
        ...((swiped || []).map((s: any) => s.target_id)),
      ])

      // Get profile views from last 14 days (avoid re-showing recent views)
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

      const { data: recentViews } = await supabase
        .from('profile_views')
        .select('viewed_id')
        .eq('viewer_id', userId)
        .gt('created_at', fourteenDaysAgo.toISOString())

      const recentViewIds = new Set<string>(
        (recentViews || []).map((v: any) => v.viewed_id)
      )

      // Load ALL eligible profiles (no limit to avoid gaps)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_onboarded', true)
        .neq('id', userId)

      if (error) {
        console.error('[SWIPE] Load profiles error:', error)
        setLoading(false)
        return
      }

      // Filter: exclude swiped, recently viewed, AND suspended accounts
      let eligible = (data || []).filter(
        (p: any) => !swipedIds.has(p.id) && !recentViewIds.has(p.id) && p.is_suspended !== true
      )

      // Apply Business Pro user preferences filters
      if (isBusinessPro && userPrefs) {
        const minAge = userPrefs.min_age || 15
        const maxAge = userPrefs.max_age || 99
        const maxDistance = userPrefs.max_distance_km || 100000
        const preferredSkills = Array.isArray(userPrefs.preferred_skills) ? userPrefs.preferred_skills : []

        // Helper to calculate distance between two points (Haversine formula)
        const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371 // Earth radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180
          const dLon = (lon2 - lon1) * Math.PI / 180
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          return R * c
        }

        eligible = eligible.filter((profile: any) => {
          // Age filter
          if (profile.age && (profile.age < minAge || profile.age > maxAge)) {
            return false
          }

          // Distance filter
          if (userPrefs.lat && userPrefs.lon && profile.lat && profile.lon) {
            const distance = calcDistance(userPrefs.lat, userPrefs.lon, profile.lat, profile.lon)
            if (distance > maxDistance) {
              return false
            }
          }

          // Skills filter (if any skills selected, profile must have at least one match)
          if (preferredSkills.length > 0) {
            const profileSkills = Array.isArray(profile.skills) ? profile.skills : []
            const hasMatchingSkill = profileSkills.some((s: any) => {
              const skillName = typeof s === 'string' ? s : s?.name
              return preferredSkills.includes(skillName)
            })
            if (!hasMatchingSkill) {
              return false
            }
          }

          return true
        })

        console.log('[SWIPE] Applied Business Pro filters - eligible after filtering:', eligible.length)
      }

      console.log('[SWIPE] Total profiles:', data?.length || 0)
      console.log('[SWIPE] Swiped:', swipedIds.size)
      console.log('[SWIPE] Recently viewed:', recentViewIds.size)
      console.log('[SWIPE] Available:', eligible.length)

      setProfiles(eligible)
    } catch (e) {
      console.error('[SWIPE] loadProfiles catch:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) loadProfiles()
  }, [userId, loadProfiles])

  // Recharger les profils quand on revient sur la page (après avoir modifié les filtres)
  useFocusEffect(
    useCallback(() => {
      if (userId) loadProfiles()
    }, [userId, loadProfiles])
  )

  // ── 2B. RECORD PROFILE VIEW ──────────────────────────────
  useEffect(() => {
    if (!userId || profiles.length === 0) return

    const currentProfile = profiles[0]

    // Record that we viewed this profile (for 14-day cooldown)
    supabase
      .from('profile_views')
      .insert({
        viewer_id: userId,
        viewed_id: currentProfile.id,
      })
      .then(({ error }) => {
        if (error) {
          console.error('[SWIPE] profile_views insert error:', error.code)
        } else {
          console.log('[SWIPE] Recorded view for', currentProfile.first_name)
        }
      })
  }, [userId, profiles.length > 0 ? profiles[0]?.id : null])

  // ── 3. HANDLE SWIPE ─────────────────────────────────────────
  const handleSwipe = useCallback(async (dir: 'left' | 'right') => {
    if (!userId || profiles.length === 0) {
      console.warn('[SWIPE] Cannot swipe - userId:', userId, 'profiles:', profiles.length)
      return
    }

    const target = profiles[0]
    console.log('[SWIPE] →', dir, target.first_name, target.id)

    // Animate card
    Animated.timing(cardScaleAnim, {
      toValue: 0.8,
      duration: 200,
      useNativeDriver: true,
    }).start()

    // Immediately remove from UI
    setProfiles(prev => prev.slice(1))
    setPhotoIdx(0)
    setLastSwiped({ profile: target, dir })

    // Reset animation for next card
    setTimeout(() => {
      cardScaleAnim.setValue(1)
    }, 200)

    // Record swipe in DB
    const { error: swipeErr } = await supabase
      .from('swipes')
      .insert({ swiper_id: userId, target_id: target.id, action: dir === 'right' ? 'like' : 'dislike' })

    if (swipeErr) {
      console.error('[SWIPE] swipes insert error:', swipeErr.code, swipeErr.message)
    } else {
      console.log('[SWIPE] Swipe saved ✓')
      // Update last_swipe_date in profile
      supabase.from('profiles').update({
        last_swipe_date: new Date().toISOString(),
      }).eq('id', userId).then(() => {})
    }

    if (dir === 'left') return

    // Record like
    const { error: likeErr } = await supabase
      .from('likes')
      .insert({ liker_id: userId, liked_id: target.id, is_viewed: false })

    // Push notification to liked user
    if (!likeErr) {
      const SUPA = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'

      // Get sender name and target plan
      const myNameRes = await supabase.from('profiles').select('first_name').eq('id', userId).single()
      const myName = myNameRes.data?.first_name || 'Quelqu\'un'

      const targetPlanRes = await supabase.from('profiles').select('subscription_plan').eq('id', target.id).single()
      const targetPlan = ((targetPlanRes.data as any)?.subscription_plan || '').toLowerCase()
      const isTargetPro = targetPlan === 'business_pro'

      // If target is Pro, show who liked them. Otherwise, generic message
      const notifBody = isTargetPro
        ? `${myName} a liké ton profil`
        : 'Tu as reçu un like ! Passe Business Pro pour savoir qui'

      fetch(`${SUPA}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': ANON },
        body: JSON.stringify({ to_user_id: target.id, title: '❤️ Nouveau like !', body: notifBody, data: { type: 'like' } }),
      }).catch(() => {})
    }

    if (likeErr) {
      console.error('[SWIPE] likes insert error:', likeErr.code, likeErr.message)
    } else {
      console.log('[SWIPE] Like saved ✓')
    }

    // Check mutual like
    const { data: mutual } = await supabase
      .from('likes')
      .select('id')
      .eq('liker_id', target.id)
      .eq('liked_id', userId)
      .maybeSingle()

    if (!mutual) return

    // MATCH !
    console.log('[SWIPE] MATCH with', target.first_name)

    const [u1, u2] = [userId, target.id].sort()
    const { error: matchErr } = await supabase
      .from('matches')
      .insert({ user1_id: u1, user2_id: u2, is_viewed: false })

    if (!matchErr) {
      // Create conversation (check it doesn't already exist)
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${u1},user2_id.eq.${u2}),and(user1_id.eq.${u2},user2_id.eq.${u1})`)
        .maybeSingle()

      if (!existingConv) {
        const { error: convErr } = await supabase
          .from('conversations')
          .insert({ user1_id: u1, user2_id: u2 })
        if (convErr) console.error('[SWIPE] conv insert error:', convErr.message)
      }

      setMatchedProfile(target)
      setShowMatchModal(true)
      console.log('[SWIPE] Match + conversation created ✓')

      // Send push notifications to both users
      const SUPA = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
      // Notify target user
      fetch(`${SUPA}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON },
        body: JSON.stringify({
          to_user_id: target.id,
          title: '🎉 Nouveau Match !',
          body: `Tu as un match avec ${(await supabase.from('profiles').select('first_name').eq('id', userId).single()).data?.first_name || 'quelqu\'un'} !`,
          data: { type: 'match' },
        }),
      }).catch(() => {})
    } else {
      // Match might already exist (race condition) — still show modal
      if (matchErr.code === '23505') {
        setMatchedProfile(target)
        setShowMatchModal(true)
      } else {
        console.error('[SWIPE] match insert error:', matchErr.message, matchErr.code)
      }
    }
  }, [userId, profiles])

  // ── 4. HANDLE UNDO ──────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    // Non-Pro: always show paywall (never actually undo)
    if (!isPro) {
      setShowUndoPaywall(true)
      return
    }
    // Pro: only undo if there's something to undo
    if (!userId || !lastSwiped) return

    const { profile: target, dir } = lastSwiped

    // Delete swipe
    await supabase.from('swipes').delete().eq('swiper_id', userId).eq('target_id', target.id)

    if (dir === 'right') {
      await supabase.from('likes').delete().eq('liker_id', userId).eq('liked_id', target.id)
      const [u1, u2] = [userId, target.id].sort()
      await supabase.from('matches').delete().eq('user1_id', u1).eq('user2_id', u2)
    }

    setProfiles(prev => [target, ...prev])
    setLastSwiped(null)
    setPhotoIdx(0)
  }, [isPro, userId, lastSwiped])

  // ── LOADING STATES ──────────────────────────────────────────
  if (!userId || (loading && profiles.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des profils...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!loading && profiles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="eye-outline" size={56} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>Aucun profil disponible</Text>
          <Text style={styles.emptyText}>Reviens plus tard pour découvrir de nouveaux talents</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={loadProfiles} activeOpacity={0.8}>
            <Text style={styles.reloadBtnText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const current = profiles[0]
  const photos = Array.isArray(current?.photos) ? (current.photos as string[]) : []
  const currentPhoto = photos.length > 0 ? photos[Math.min(photoIdx, photos.length - 1)] : undefined
  const interests = Array.isArray(current?.interests) ? (current.interests as string[]) : []
  const skills = Array.isArray((current as any)?.skills) ? ((current as any).skills as any[]) : []

  return (
    <SafeAreaView style={styles.container}>
      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Découvrir</Text>
              <Text style={styles.headerSubtitle}>Les meilleurs profils business</Text>
            </View>
            <TouchableOpacity
              style={styles.filterIconBtn}
              onPress={() => {
                if (isPro) {
                  router.push('/profile/preferences' as any)
                } else {
                  Alert.alert(
                    '🔒 Fonctionnalité Business Pro',
                    'Les filtres avancés sont réservés aux membres Business Pro.',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Passer Business Pro', onPress: () => router.push('/settings?scroll=pro' as any) },
                    ]
                  )
                }
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="options" size={22} color={isPro ? colors.primary : colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Name & Age - Above Photo */}
        {current && (
          <View style={styles.profileHeaderCard}>
            <Text style={styles.profileHeaderName}>
              {current.first_name || 'Utilisateur'}
              {current.age ? <Text style={styles.profileHeaderAge}>, {current.age}</Text> : null}
            </Text>
          </View>
        )}

        {/* Photo Card */}
        <Animated.View style={[styles.cardContainer, { transform: [{ scale: cardScaleAnim }] }]}>
          <View style={[styles.card, { height: PHOTO_HEIGHT }]}>
            <ProfileImage
              photos={currentPhoto ? [currentPhoto] : []}
              style={styles.photo}
              placeholder={styles.photoPlaceholder}
            />

            {/* Photo progress bars */}
            {photos.length > 1 && (
              <View style={styles.photoBars}>
                {photos.map((_, i) => (
                  <View key={i} style={styles.photoBarTrack}>
                    <View style={[styles.photoBarFill, i <= photoIdx && styles.photoBarFillActive]} />
                  </View>
                ))}
              </View>
            )}

            {/* Photo nav — tap zones left/right */}
            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  style={styles.photoTapLeft}
                  onPress={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  activeOpacity={1}
                />
                <TouchableOpacity
                  style={styles.photoTapRight}
                  onPress={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                  activeOpacity={1}
                />
              </>
            )}

            {/* Profile Info - Overlay on photo */}
            <View style={styles.profileOverlay}>
              <View>
                <Text style={styles.profileName}>
                  {current?.first_name || 'Utilisateur'}
                  {current?.age ? <Text style={styles.profileAge}>, {current.age}</Text> : null}
                </Text>
                {current?.city ? (
                  <View style={styles.cityBadge}>
                    <Ionicons name="location" size={11} color={colors.primary} />
                    <Text style={styles.cityText}>{current.city}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.photoActionButtons}>
              {/* Undo */}
              <TouchableOpacity
                style={[styles.btn, styles.btnUndo, (isPro && !lastSwiped) && { opacity: 0.35 }]}
                onPress={handleUndo}
                activeOpacity={0.75}
                disabled={isPro && !lastSwiped}
              >
                <Ionicons name="arrow-undo" size={20} color={colors.text.primary} />
              </TouchableOpacity>

              {/* Dislike / Nope */}
              <TouchableOpacity
                style={[styles.btn, styles.btnDislike]}
                onPress={() => handleSwipe('left')}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={32} color="#FF6B6B" />
              </TouchableOpacity>

              {/* Like */}
              <TouchableOpacity
                style={[styles.btn, styles.btnLike]}
                onPress={() => handleSwipe('right')}
                activeOpacity={0.75}
              >
                <Ionicons name="heart" size={28} color={colors.bg.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Location Card - Between Photo and Bio */}
        {current?.city && (
          <View style={styles.locationCard}>
            <Ionicons name="location-sharp" size={16} color={colors.primary} />
            <Text style={styles.locationText}>{current.city}</Text>
          </View>
        )}

        {/* ── BIOGRAPHIE ── */}
        {current?.bio && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoCardIconWrap}>
                <Ionicons name="document-text" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Biographie</Text>
            </View>
            <Text style={styles.bioText}>{current.bio}</Text>
          </View>
        )}

        {/* ── CENTRES D'INTÉRÊT ── */}
        {interests.length > 0 && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoCardIconWrap}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Centres d'intérêt</Text>
            </View>
            <View style={styles.tagsRow}>
              {interests.map((it, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{it}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── COMPÉTENCES ── */}
        {skills.length > 0 && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoCardIconWrap}>
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoCardTitle}>Compétences</Text>
            </View>
            <View style={styles.skillsList}>
              {skills.map((skill: any, i: number) => {
                const name = typeof skill === 'string' ? skill : skill?.name || ''
                const level = typeof skill?.level === 'number' ? skill.level : 5
                if (!name) return null
                return (
                  <View key={i} style={styles.skillRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.skillMeta}>
                        <Text style={styles.skillName}>{name}</Text>
                        <Text style={styles.skillLevel}>{LEVEL_LABELS[level] ?? 'Intermédiaire'}</Text>
                      </View>
                      <View style={styles.levelTrack}>
                        <View style={[styles.levelFill, { width: `${level * 10}%` as any }]} />
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── MATCH MODAL ── */}
      <Modal visible={showMatchModal} transparent animationType="fade" onRequestClose={() => setShowMatchModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>C'est un Match !</Text>
            <ProfileImage
              photos={(matchedProfile?.photos as any) || []}
              style={styles.matchAvatar}
              placeholder={styles.matchAvatarPh}
            />
            <Text style={styles.matchName}>
              {matchedProfile?.first_name}{matchedProfile?.age ? `, ${matchedProfile.age}` : ''}
            </Text>
            <View style={styles.matchBtns}>
              <TouchableOpacity
                style={[styles.matchBtn, styles.matchBtnPrimary]}
                onPress={() => { setShowMatchModal(false); router.push('/messages' as any) }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={18} color={colors.bg.primary} />
                <Text style={styles.matchBtnPrimaryTxt}>Envoyer un message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.matchBtn, styles.matchBtnSecondary]} onPress={() => setShowMatchModal(false)} activeOpacity={0.8}>
                <Text style={styles.matchBtnSecondaryTxt}>Continuer à swiper</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── UNDO PAYWALL ── */}
      <Modal visible={showUndoPaywall} transparent animationType="fade" onRequestClose={() => setShowUndoPaywall(false)}>
        <View style={styles.overlay}>
          <View style={styles.paywallCard}>
            <Ionicons name="arrow-undo" size={44} color={colors.primary} />
            <Text style={styles.paywallTitle}>Revenir en arrière</Text>
            <Text style={styles.paywallText}>
              Tu as swipé trop vite ? Le retour en arrière te permet de revoir le profil que tu viens de passer.
            </Text>
            <Text style={styles.paywallFeature}>💎 Fonctionnalité exclusive Business Pro</Text>
            <TouchableOpacity style={styles.paywallBtn} onPress={() => { setShowUndoPaywall(false); router.push('/settings?scroll=pro' as any) }} activeOpacity={0.8}>
              <Ionicons name="trophy" size={18} color={colors.bg.primary} />
              <Text style={styles.paywallBtnTxt}>Passer Business Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paywallBtnSec} onPress={() => setShowUndoPaywall(false)}>
              <Text style={styles.paywallBtnSecTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  loadingText: { color: colors.text.secondary, marginTop: spacing.lg, fontSize: 14, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { paddingVertical: spacing.lg, paddingHorizontal: spacing.md },

  // Header
  header: { marginBottom: spacing.xxl, paddingHorizontal: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.primary, fontSize: 32, fontWeight: '800', letterSpacing: 0.5, marginBottom: spacing.xs },
  headerSubtitle: { color: colors.text.secondary, fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1.5,
    borderColor: colors.border.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile Header (Name & Age above photo)
  profileHeaderCard: { marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  profileHeaderName: { color: colors.text.primary, fontSize: 24, fontWeight: '700', letterSpacing: 0.3 },
  profileHeaderAge: { color: colors.text.secondary, fontSize: 24, fontWeight: '500' },

  // Location Card
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl, marginHorizontal: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.bg.tertiary, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.secondary },
  locationText: { color: colors.text.secondary, fontSize: 14, fontWeight: '500' },

  // Card Container
  cardContainer: { marginBottom: spacing.xxl },
  card: { borderRadius: borderRadius.xxl, overflow: 'hidden', backgroundColor: colors.bg.tertiary },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.bg.quaternary },

  // Photo Bars
  photoBars: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', gap: spacing.xs, zIndex: 10 },
  photoBarTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1.5, overflow: 'hidden' },
  photoBarFill: { height: '100%', backgroundColor: 'transparent' },
  photoBarFillActive: { backgroundColor: colors.primary },

  // Photo Navigation
  photoTapLeft: { position: 'absolute', left: 0, top: 30, bottom: 90, width: '38%', zIndex: 25 },
  photoTapRight: { position: 'absolute', right: 0, top: 30, bottom: 90, width: '38%', zIndex: 25 },

  // Profile Overlay
  profileOverlay: { position: 'absolute', bottom: 90, left: spacing.lg, right: spacing.lg, zIndex: 20 },
  profileName: { color: colors.text.primary, fontSize: 26, fontWeight: '700', letterSpacing: 0.3 },
  profileAge: { color: colors.text.secondary, fontSize: 26, fontWeight: '500' },
  cityBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: 'rgba(212, 175, 55, 0.15)', borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  cityText: { color: colors.text.secondary, fontSize: 12, fontWeight: '500' },

  // Action Buttons
  photoActionButtons: { position: 'absolute', bottom: spacing.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xl, paddingHorizontal: spacing.lg, zIndex: 30 },

  // Info Cards (Tinder-style content cards — replace plain "lines of text")
  infoCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    padding: spacing.xl,
    ...shadows.sm,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  infoCardIconWrap: {
    width: 32, height: 32, borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.14)', alignItems: 'center', justifyContent: 'center',
  },
  infoCardTitle: { color: colors.text.primary, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  bioText: { color: colors.text.secondary, fontSize: 14, lineHeight: 22, fontWeight: '500', letterSpacing: 0.2 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tag: { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.4)' },
  tagText: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },

  // Skills
  skillsList: { gap: spacing.lg },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  skillMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  skillName: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  skillLevel: { color: colors.text.tertiary, fontSize: 11, fontWeight: '500' },
  levelTrack: { height: 6, backgroundColor: colors.bg.quaternary, borderRadius: 3, overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },

  // Empty State
  emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700', marginTop: spacing.lg, textAlign: 'center' },
  emptyText: { color: colors.text.secondary, fontSize: 13, marginTop: spacing.md, textAlign: 'center', lineHeight: 20 },
  reloadBtn: { marginTop: spacing.xxl, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, ...shadows.glow },
  reloadBtnText: { color: colors.bg.primary, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },

  // Buttons
  btn: { width: 66, height: 66, borderRadius: 33, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  btnUndo: { backgroundColor: colors.bg.tertiary, borderWidth: 1.5, borderColor: colors.border.primary, width: 56, height: 56, borderRadius: 28 },
  btnDislike: { backgroundColor: colors.bg.tertiary, borderWidth: 2, borderColor: 'rgba(255, 107, 107, 0.6)', shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8 },
  btnLike: { backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.primaryLight, ...shadows.glow },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },

  matchCard: { width: '100%', maxWidth: 320, backgroundColor: colors.bg.tertiary, borderRadius: borderRadius.xxl, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  matchEmoji: { fontSize: 48, marginBottom: spacing.md },
  matchTitle: { color: colors.primary, fontSize: 24, fontWeight: '800', marginBottom: spacing.lg, letterSpacing: 0.5 },
  matchAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.primary },
  matchAvatarPh: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.bg.quaternary },
  matchName: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: spacing.xl },
  matchBtns: { width: '100%', gap: spacing.md },
  matchBtn: { paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  matchBtnPrimary: { backgroundColor: colors.primary, ...shadows.glow },
  matchBtnPrimaryTxt: { color: colors.bg.primary, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  matchBtnSecondary: { backgroundColor: colors.bg.quaternary, borderWidth: 1, borderColor: colors.border.primary },
  matchBtnSecondaryTxt: { color: colors.text.primary, fontWeight: '600', fontSize: 14 },

  paywallCard: { width: '100%', maxWidth: 320, backgroundColor: colors.bg.tertiary, borderRadius: borderRadius.xxl, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  paywallTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700', letterSpacing: 0.3 },
  paywallText: { color: colors.text.secondary, fontSize: 13, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  paywallFeature: { color: colors.primary, fontSize: 12, fontWeight: '600', marginVertical: spacing.sm },
  paywallBtn: { backgroundColor: colors.primary, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: borderRadius.lg, width: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, ...shadows.glow },
  paywallBtnTxt: { color: colors.bg.primary, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  paywallBtnSec: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  paywallBtnSecTxt: { color: colors.text.tertiary, fontSize: 12, fontWeight: '600' },
})
