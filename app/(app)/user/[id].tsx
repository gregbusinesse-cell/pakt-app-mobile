import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, Dimensions } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
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

export default function UserProfilePage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single()

        if (error) console.error('[USER_PROFILE]', error)
        else setProfile(data)
      } catch (e) {
        console.error('[USER_PROFILE]', e)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ffffff44" />
          <Text style={styles.emptyTitle}>Profil non trouvé</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={() => router.back()}>
            <Text style={styles.reloadBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const photos = Array.isArray(profile?.photos) ? (profile.photos as string[]) : []
  const currentPhoto = photos.length > 0 ? photos[Math.min(photoIdx, photos.length - 1)] : undefined
  const interests = Array.isArray(profile?.interests) ? (profile.interests as string[]) : []
  const skills = Array.isArray((profile as any)?.skills) ? ((profile as any).skills as any[]) : []

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color="#ffd700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.first_name}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.profileHeader}>
          <Text style={styles.name}>
            {profile?.first_name || 'Utilisateur'}
            {profile?.age ? <Text style={styles.age}>, {profile.age}</Text> : null}
          </Text>
          {profile?.city ? (
            <View style={styles.cityRow}>
              <Ionicons name="location" size={13} color="#ffd700" />
              <Text style={styles.city}>{profile.city}</Text>
            </View>
          ) : null}
        </View>

        {photos.length > 0 && (
          <View style={styles.card}>
            <View style={[styles.photoContainer, { height: PHOTO_HEIGHT }]}>
              <ProfileImage photos={currentPhoto ? [currentPhoto] : []} style={styles.photo} placeholder={styles.photoPlaceholder} />

              {photos.length > 1 && (
                <View style={styles.photoBars}>
                  {photos.map((_, i) => (
                    <View key={i} style={styles.photoBarTrack}>
                      <View style={[styles.photoBarFill, i <= photoIdx && styles.photoBarFillActive]} />
                    </View>
                  ))}
                </View>
              )}

              {photos.length > 1 && (
                <View style={styles.photoNavRow}>
                  <TouchableOpacity style={styles.photoNavBtn} onPress={() => setPhotoIdx(i => Math.max(0, i - 1))} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.photoNavBtn} onPress={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biographie</Text>
          {profile?.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : <Text style={styles.emptyMsg}>Aucune biographie</Text>}
        </View>

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
            <Text style={styles.emptyMsg}>Aucun centre d'intérêt</Text>
          )}
        </View>

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
            <Text style={styles.emptyMsg}>Aucune compétence</Text>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#fff', marginTop: 12 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  profileHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  age: { fontSize: 24 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  city: { color: '#ffd700', fontSize: 14, fontWeight: '500' },
  card: { marginHorizontal: 16, marginVertical: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  photoContainer: { width: '100%', backgroundColor: '#333', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#333' },
  photoBars: { flexDirection: 'row', position: 'absolute', top: 8, left: 8, right: 8, gap: 4 },
  photoBarTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' },
  photoBarFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', width: '0%' },
  photoBarFillActive: { backgroundColor: '#ffd700', width: '100%' },
  photoNavRow: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  photoNavBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  section: { marginHorizontal: 20, marginVertical: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  bioText: { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  emptyMsg: { color: '#ffffff66', fontSize: 14, fontStyle: 'italic' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#ffd700', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: '#ffd700', fontSize: 13, fontWeight: '500' },
  skillsList: { gap: 16 },
  skillRow: { gap: 12 },
  skillMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  skillName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  skillLevel: { color: '#ffd700', fontSize: 12, fontWeight: '500' },
  levelTrack: { height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: '#ffd700' },
  reloadBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#ffd700', borderRadius: 8 },
  reloadBtnText: { color: '#000', fontWeight: '700' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
})
