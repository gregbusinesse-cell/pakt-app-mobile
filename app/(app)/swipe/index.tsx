import { useState, useEffect, useCallback } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import { ProfileImage } from '@/components/ProfileImage'
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
      const eligible = (data || []).filter(
        (p: any) => !swipedIds.has(p.id) && !recentViewIds.has(p.id) && p.is_suspended !== true
      )

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

    // Immediately remove from UI
    setProfiles(prev => prev.slice(1))
    setPhotoIdx(0)
    setLastSwiped({ profile: target, dir })

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
      const myName = (await supabase.from('profiles').select('first_name').eq('id', userId).single()).data?.first_name || 'Quelqu\'un'
      fetch(`${SUPA}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': ANON },
        body: JSON.stringify({ to_user_id: target.id, title: '❤️ Nouveau like !', body: `${myName} a liké ton profil`, data: { type: 'like' } }),
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
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!loading && profiles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="eye-outline" size={48} color="#ffffff44" />
          <Text style={styles.emptyTitle}>Aucun profil disponible</Text>
          <Text style={styles.emptyText}>Reviens plus tard pour découvrir de nouveaux profils</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={loadProfiles}>
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
          <Text style={styles.title}>PAKT</Text>
        </View>

        {/* Name / Age / City */}
        <View style={styles.profileHeader}>
          <Text style={styles.name}>
            {current?.first_name || 'Utilisateur'}
            {current?.age ? <Text style={styles.age}>, {current.age}</Text> : null}
          </Text>
          {current?.city ? (
            <View style={styles.cityRow}>
              <Ionicons name="location" size={13} color="#ffd700" />
              <Text style={styles.city}>{current.city}</Text>
            </View>
          ) : null}
        </View>

        {/* Photo Card */}
        <View style={styles.card}>
          <View style={[styles.photoContainer, { height: PHOTO_HEIGHT }]}>
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

            {/* Photo nav — tap zones left/right (above action buttons) */}
            {photos.length > 1 && (
              <>
                {/* Left tap zone */}
                <TouchableOpacity
                  style={styles.photoTapLeft}
                  onPress={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  activeOpacity={1}
                />
                {/* Right tap zone */}
                <TouchableOpacity
                  style={styles.photoTapRight}
                  onPress={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                  activeOpacity={1}
                />
              </>
            )}

            {/* Action Buttons - Bottom of photo */}
            <View style={styles.photoBottomButtons}>
              {/* Undo - always visible, dimmed if no history */}
              <TouchableOpacity
                style={[styles.btn, styles.btnUndo, (isPro && !lastSwiped) && { opacity: 0.35 }]}
                onPress={handleUndo}
                activeOpacity={0.75}
                disabled={isPro && !lastSwiped}
              >
                <Ionicons name="arrow-undo" size={22} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>

              {/* Dislike / Nope */}
              <TouchableOpacity
                style={[styles.btn, styles.btnDislike]}
                onPress={() => handleSwipe('left')}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={32} color="#ff4444" />
              </TouchableOpacity>

              {/* Like */}
              <TouchableOpacity
                style={[styles.btn, styles.btnLike]}
                onPress={() => handleSwipe('right')}
                activeOpacity={0.75}
              >
                <Ionicons name="heart" size={28} color="#0a0a0a" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── BIOGRAPHIE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biographie</Text>
          {current?.bio
            ? <Text style={styles.bioText}>{current.bio}</Text>
            : <Text style={styles.emptyMsg}>Cette personne n'a pas encore rédigé sa biographie</Text>
          }
        </View>

        {/* ── CENTRES D'INTÉRÊT ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
          {interests.length > 0 ? (
            <View style={styles.tagsRow}>
              {interests.map((it, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{it}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyMsg}>Cette personne n'a pas renseigné ses centres d'intérêt</Text>
          )}
        </View>

        {/* ── COMPÉTENCES ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compétences</Text>
          {skills.length > 0 ? (
            <View style={styles.skillsList}>
              {skills.map((skill: any, i: number) => {
                const name = typeof skill === 'string' ? skill : skill?.name || ''
                const level = typeof skill?.level === 'number' ? skill.level : 5
                if (!name) return null
                return (
                  <View key={i} style={styles.skillRow}>
                    <View style={styles.skillMeta}>
                      <Text style={styles.skillName}>{name}</Text>
                      <Text style={styles.skillLevel}>{LEVEL_LABELS[level] ?? 'Intermédiaire'}</Text>
                    </View>
                    <View style={styles.levelTrack}>
                      <View style={[styles.levelFill, { width: `${level * 10}%` as any }]} />
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={styles.emptyMsg}>Cette personne n'a pas renseigné ses compétences</Text>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── MATCH MODAL ── */}
      <Modal visible={showMatchModal} transparent animationType="fade" onRequestClose={() => setShowMatchModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.matchCard}>
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
              >
                <Text style={styles.matchBtnPrimaryTxt}>Envoyer un message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.matchBtn, styles.matchBtnSecondary]} onPress={() => setShowMatchModal(false)}>
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
            <Ionicons name="arrow-undo" size={40} color="#ffd700" />
            <Text style={styles.paywallTitle}>Revenir en arrière</Text>
            <Text style={styles.paywallText}>
              Tu as swipé trop vite ? Le retour en arrière te permet de revoir le profil que tu viens de passer. Fonctionnalité réservée aux membres Business Pro.
            </Text>
            <TouchableOpacity style={styles.paywallBtn} onPress={() => { setShowUndoPaywall(false); router.push('/settings?scroll=pro' as any) }}>
              <Text style={styles.paywallBtnTxt}>Passer Business Pro →</Text>
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
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#fff', marginTop: 12 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  title: { color: '#ffd700', fontSize: 22, fontWeight: '700' },

  profileHeader: { paddingHorizontal: 20, paddingBottom: 10 },
  name: { color: '#fff', fontSize: 28, fontWeight: '700' },
  age: { color: '#ffffff88', fontSize: 28, fontWeight: '400' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  city: { color: '#ffffff99', fontSize: 14 },

  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111' },
  photoContainer: { width: '100%', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },

  photoBars: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 4, zIndex: 10 },
  photoBarTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' },
  photoBarFill: { height: '100%', backgroundColor: 'transparent' },
  photoBarFillActive: { backgroundColor: '#fff' },

  // Tap zones for photo navigation (covers top 60% of photo, below bars)
  photoTapLeft:  { position: 'absolute', left: 0,   top: 30, bottom: 90, width: '38%', zIndex: 25 },
  photoTapRight: { position: 'absolute', right: 0,  top: 30, bottom: 90, width: '38%', zIndex: 25 },

  photoBottomButtons: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 20, zIndex: 30 },

  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { color: '#ffd700', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  bioText: { color: '#ffffffcc', fontSize: 15, lineHeight: 22 },
  emptyMsg: { color: '#ffffff55', fontSize: 13, fontStyle: 'italic' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#ffd70018', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, borderColor: '#ffd700' },
  tagText: { color: '#ffd700', fontSize: 13, fontWeight: '600' },

  skillsList: { gap: 12 },
  skillRow: { gap: 5 },
  skillMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  skillLevel: { color: '#ffffff66', fontSize: 12 },
  levelTrack: { height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: '#ffd700', borderRadius: 2 },

  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyText: { color: '#ffffff66', fontSize: 13, marginTop: 8, textAlign: 'center' },
  reloadBtn: { marginTop: 20, backgroundColor: '#ffd700', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  reloadBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  btn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  btnUndo: { backgroundColor: '#1c1c1e', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', width: 54, height: 54, borderRadius: 27 },
  btnDislike: { backgroundColor: '#1c1c1e', borderWidth: 2, borderColor: 'rgba(255,68,68,0.6)', shadowColor: '#ff4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 },
  btnLike: { backgroundColor: '#d4a853', borderWidth: 2, borderColor: '#e8c06a', shadowColor: '#d4a853', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },

  matchCard: { width: '85%', maxWidth: 340, backgroundColor: '#1a1a1a', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#ffd70044' },
  matchEmoji: { fontSize: 40, marginBottom: 8 },
  matchTitle: { color: '#ffd700', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  matchAvatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 10 },
  matchAvatarPh: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#333' },
  matchName: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 20 },
  matchBtns: { width: '100%', gap: 10 },
  matchBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  matchBtnPrimary: { backgroundColor: '#ffd700' },
  matchBtnPrimaryTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  matchBtnSecondary: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444' },
  matchBtnSecondaryTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },

  paywallCard: { width: '85%', maxWidth: 340, backgroundColor: '#1a1a1a', borderRadius: 20, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#ff980044' },
  paywallTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  paywallText: { color: '#ffffff88', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  paywallBtn: { backgroundColor: '#ffd700', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center' },
  paywallBtnTxt: { color: '#000', fontWeight: '700', fontSize: 14 },
  paywallBtnSec: { paddingVertical: 10 },
  paywallBtnSecTxt: { color: '#ffffff66', fontSize: 13 },
})
