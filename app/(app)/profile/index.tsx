import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  ActivityIndicator, ScrollView, Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { ProfileImage } from '@/components/ProfileImage'
import { supabase } from '@/lib/supabase/client'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'

const { width: SW } = Dimensions.get('window')
const PHOTO_HEIGHT = Math.min(400, Math.round((SW - spacing.lg * 2) * 1.3))

const LEVEL_LABELS: Record<number, string> = {
  1: 'Débutant', 2: 'Débutant', 3: 'Débutant +',
  4: 'Intermédiaire', 5: 'Intermédiaire', 6: 'Intermédiaire +',
  7: 'Avancé', 8: 'Avancé', 9: 'Expert', 10: 'Expert',
}

export default function ProfilePage() {
  const router = useRouter()
  const { profile, loading } = useCurrentUser()
  const [photoIdx, setPhotoIdx] = useState(0)
  const [userPlan, setUserPlan] = useState<'free' | 'business' | 'business_pro'>('free')

  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return

        const { data } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', session.user.id)
          .single()

        if (data?.subscription_plan) {
          setUserPlan(data.subscription_plan.toLowerCase() as any)
        }
      } catch (err) {
        console.error('Error fetching user plan:', err)
      }
    }

    fetchUserPlan()
  }, [])

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitions.normal,
        useNativeDriver: true,
      }).start()
    }
  }, [loading])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={colors.text.disabled} />
          <Text style={styles.emptyText}>Profil non disponible</Text>
        </View>
      </SafeAreaView>
    )
  }

  const photos = Array.isArray(profile.photos) ? (profile.photos as string[]) : []
  const interests = Array.isArray(profile.interests) ? (profile.interests as string[]) : []
  const skills = Array.isArray((profile as any).skills) ? ((profile as any).skills as any[]) : []

  const currentPhoto = photos.length > 0 ? photos[Math.min(photoIdx, photos.length - 1)] : undefined
  const goNext = () => { if (photoIdx < photos.length - 1) setPhotoIdx(i => i + 1) }
  const goPrev = () => { if (photoIdx > 0) setPhotoIdx(i => i - 1) }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>Mon Profil</Text>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/profile/edit' as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
            <Text style={styles.editBtnText}>Modifier</Text>
          </TouchableOpacity>

          {userPlan === 'business_pro' && (
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => router.push('/profile/preferences' as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="sliders" size={16} color={colors.success} />
              <Text style={styles.filterBtnText}>Filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Name + Age */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {profile.first_name || 'Utilisateur'}
            {profile.age ? <Text style={styles.age}>, {profile.age}</Text> : null}
          </Text>
        </View>

        {/* City Badge */}
        {profile.city ? (
          <View style={styles.cityBadgeContainer}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.cityText}>{profile.city}</Text>
          </View>
        ) : null}

        {/* Photo Card */}
        <View style={[styles.photoCard, { height: PHOTO_HEIGHT }]}>
          <ProfileImage
            photos={currentPhoto ? [currentPhoto] : []}
            style={styles.photoImg}
            placeholder={styles.photoPlaceholder}
          />

          {photos.length === 0 && (
            <View style={styles.noPhotoOverlay}>
              <Ionicons name="camera" size={52} color={colors.text.disabled} />
              <Text style={styles.noPhotoText}>Ajoute des photos</Text>
            </View>
          )}

          {/* Photo Progress Bars */}
          {photos.length > 1 && (
            <View style={styles.photoBars}>
              {photos.map((_, i) => (
                <View key={i} style={styles.photoBarTrack}>
                  <View style={[styles.photoBarFill, i <= photoIdx && styles.photoBarFillActive]} />
                </View>
              ))}
            </View>
          )}

          {/* Tap Zones */}
          {photos.length > 1 && (
            <>
              <TouchableWithoutFeedback onPress={goPrev}>
                <View style={styles.tapLeft} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback onPress={goNext}>
                <View style={styles.tapRight} />
              </TouchableWithoutFeedback>
            </>
          )}
        </View>

        {/* Bio Card */}
        {profile.bio ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="document-text" size={16} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Biographie</Text>
            </View>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Interests Card */}
        {interests.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Centres d'intérêt</Text>
            </View>
            <View style={styles.tagsRow}>
              {interests.map((it, i) => (
                <View key={i} style={styles.interestTag}>
                  <Text style={styles.interestText}>{it}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Skills Card */}
        {skills.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Compétences</Text>
            </View>
            <View style={styles.skillsList}>
              {skills.map((skill: any, i: number) => {
                const name = typeof skill === 'string' ? skill : skill?.name || ''
                const level = typeof skill?.level === 'number' ? skill.level : 5
                if (!name) return null
                return (
                  <View key={i} style={styles.skillRow}>
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillBadgeText}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{name}</Text>
                        <Text style={styles.skillLevel}>{LEVEL_LABELS[level] ?? 'Intermédiaire'}</Text>
                      </View>
                      <View style={styles.levelBarTrack}>
                        <View style={[styles.levelBarFill, { width: `${level * 10}%` as any }]} />
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: spacing.xxxl }} />
      </Animated.ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  emptyText: { color: colors.text.primary, fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  loadingText: { color: colors.text.secondary, marginTop: spacing.lg, fontSize: 14, fontWeight: '500' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
  },
  topTitle: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  buttonGroup: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: colors.primary,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  editBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: colors.success,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  filterBtnText: { color: colors.success, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.lg },

  // Name + Age
  nameRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  name: { color: colors.text.primary, fontSize: 32, fontWeight: '800', letterSpacing: 0.3 },
  age: { color: colors.text.secondary, fontSize: 32, fontWeight: '500' },

  // City Badge
  cityBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cityText: { color: colors.text.secondary, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },

  // Photo card
  photoCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.bg.tertiary,
    position: 'relative',
    ...shadows.md,
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.bg.quaternary },
  noPhotoOverlay: {
    position: 'absolute',
    inset: 0 as any,
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  noPhotoText: { color: colors.text.disabled, fontSize: 14, fontWeight: '600' },

  // Photo Progress Bars
  photoBars: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 10,
  },
  photoBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  photoBarFill: {
    height: '100%',
    width: '0%',
    backgroundColor: 'transparent',
    borderRadius: 1.5,
  },
  photoBarFillActive: {
    width: '100%',
    backgroundColor: colors.primary,
  },

  // Tap Zones
  tapLeft: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: '35%',
    zIndex: 5,
  },
  tapRight: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: '65%',
    zIndex: 5,
  },

  // Cards (Tinder-style content cards — replace plain "lines of text")
  card: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    padding: spacing.xl,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bioText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0.2,
  },

  // Interests
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  interestTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  interestText: { color: colors.primary, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },

  // Skills
  skillsList: { gap: spacing.lg },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  skillBadge: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillBadgeText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  skillInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  skillName: { color: colors.text.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  skillLevel: { color: colors.text.tertiary, fontSize: 12, fontWeight: '500' },
  levelBarTrack: {
    height: 6,
    backgroundColor: colors.bg.quaternary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
})
