import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { ProfileImage } from '@/components/ProfileImage'
import { supabase } from '@/lib/supabase/client'

const { width: SW } = Dimensions.get('window')
const PHOTO_HEIGHT = Math.min(360, Math.round((SW - 32) * 1.3))

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffd700" />
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Non connecté</Text>
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
      {/* ── Barre du haut fixe ── */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Mon profil</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/profile/edit' as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={16} color="#ffd700" />
            <Text style={styles.editBtnText}>Modifier</Text>
          </TouchableOpacity>

          {userPlan === 'business_pro' && (
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => router.push('/profile/preferences' as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="filter" size={16} color="#4caf50" />
              <Text style={styles.filterBtnText}>Filtres</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Prénom, âge ── */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {profile.first_name || 'Utilisateur'}
            {profile.age ? <Text style={styles.age}>, {profile.age}</Text> : null}
          </Text>
        </View>

        {/* ── Ville ── */}
        {profile.city ? (
          <View style={styles.cityRow}>
            <Ionicons name="location" size={14} color="#ffd700" />
            <Text style={styles.cityText}>{profile.city}</Text>
          </View>
        ) : null}

        {/* ── Carte photo ── */}
        <View style={[styles.photoCard, { height: PHOTO_HEIGHT }]}>
          {/* Image */}
          <ProfileImage
            photos={currentPhoto ? [currentPhoto] : []}
            style={styles.photoImg}
            placeholder={styles.photoPlaceholder}
          />

          {photos.length === 0 && (
            <View style={styles.noPhotoOverlay}>
              <Ionicons name="camera-outline" size={48} color="#ffffff33" />
              <Text style={styles.noPhotoText}>Aucune photo</Text>
            </View>
          )}

          {/* Barres de progression (style Tinder) */}
          {photos.length > 1 && (
            <View style={styles.photoBars}>
              {photos.map((_, i) => (
                <View key={i} style={styles.photoBarTrack}>
                  <View style={[styles.photoBarFill, i <= photoIdx && styles.photoBarFillActive]} />
                </View>
              ))}
            </View>
          )}

          {/* Zones de tap gauche / droite */}
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

        {/* ── Biographie ── */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biographie</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* ── Centres d'intérêt ── */}
        {interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
            <View style={styles.tagsRow}>
              {interests.map((it, i) => (
                <View key={i} style={styles.interestTag}>
                  <Text style={styles.interestText}>{it}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Compétences ── */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compétences</Text>
            <View style={styles.skillsList}>
              {skills.map((skill: any, i: number) => {
                const name = typeof skill === 'string' ? skill : skill?.name || ''
                const level = typeof skill?.level === 'number' ? skill.level : 5
                if (!name) return null
                return (
                  <View key={i} style={styles.skillRow}>
                    <View style={styles.skillInfo}>
                      <Text style={styles.skillName}>{name}</Text>
                      <Text style={styles.skillLevel}>{LEVEL_LABELS[level] ?? 'Intermédiaire'}</Text>
                    </View>
                    <View style={styles.levelBarTrack}>
                      <View style={[styles.levelBarFill, { width: `${level * 10}%` as any }]} />
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  buttonGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffd70015',
    borderColor: '#ffd700',
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  editBtnText: { color: '#ffd700', fontSize: 13, fontWeight: '600' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4caf5015',
    borderColor: '#4caf50',
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterBtnText: { color: '#4caf50', fontSize: 13, fontWeight: '600' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Nom + âge
  nameRow: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 },
  name: { color: '#fff', fontSize: 32, fontWeight: '700' },
  age: { color: '#ffffffcc', fontSize: 32, fontWeight: '400' },

  // Ville
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  cityText: { color: '#ffffff99', fontSize: 16, fontWeight: '400' },

  // Photo card
  photoCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  noPhotoOverlay: {
    position: 'absolute',
    inset: 0 as any,
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  noPhotoText: { color: '#ffffff33', fontSize: 13 },

  // Barres tinder
  photoBars: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  photoBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  photoBarFill: {
    height: '100%',
    width: '0%',
    backgroundColor: 'transparent',
    borderRadius: 2,
  },
  photoBarFillActive: {
    width: '100%',
    backgroundColor: '#fff',
  },

  // Zones de tap
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

  // Sections
  section: {
    marginTop: 22,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#ffd700',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  bioText: {
    color: '#ffffffcc',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },

  // Intérêts
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#ffd70018',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  interestText: { color: '#ffd700', fontSize: 15, fontWeight: '600' },

  // Compétences
  skillsList: { gap: 12 },
  skillRow: { gap: 6 },
  skillInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skillLevel: { color: '#ffffff66', fontSize: 14, fontWeight: '400' },
  levelBarTrack: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: '#ffd700',
    borderRadius: 2,
  },
})
