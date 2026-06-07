import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  SafeAreaView, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'

const BASE_SKILLS = [
  'Marketing', 'Vente / Closing', 'Copywriting', 'IA / Automation',
  'Développement Web', 'Stratégie digitale', 'Réseaux sociaux',
  'Montage vidéo', 'Ads / Acquisition', 'SEO / Growth',
]

export default function PreferencesPage() {
  const router = useRouter()

  // States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userPlan, setUserPlan] = useState<'free' | 'business' | 'business_pro'>('free')

  // Filter states
  const [minAge, setMinAge] = useState('15')
  const [maxAge, setMaxAge] = useState('99')
  const [maxDistance, setMaxDistance] = useState('10000')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          router.back()
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_plan, min_age, max_age, max_distance_km, preferred_skills')
          .eq('id', session.user.id)
          .single()

        if (error) throw error

        const plan = data?.subscription_plan?.toLowerCase() as any || 'free'
        setUserPlan(plan)

        // Set defaults for FREE/BUSINESS users
        if (plan !== 'business_pro') {
          setMinAge('15')
          setMaxAge('99')
          setMaxDistance('10000')
          setSelectedSkills([])
        } else {
          // Load actual preferences for Business Pro
          setMinAge(String(data?.min_age || 15))
          setMaxAge(String(data?.max_age || 99))
          setMaxDistance(String(data?.max_distance_km || 10000))
          setSelectedSkills(Array.isArray(data?.preferred_skills) ? data.preferred_skills : [])
        }
      } catch (err) {
        console.error('Error loading preferences:', err)
        Alert.alert('Erreur', 'Impossible de charger les préférences')
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [])

  const handleSavePreferences = async () => {
    try {
      setSaving(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        Alert.alert('Erreur', 'Session expirée')
        return
      }

      const minAgeNum = Math.max(15, Math.min(parseInt(minAge) || 15, 99))
      const maxAgeNum = Math.max(15, Math.min(parseInt(maxAge) || 99, 99))
      const maxDistNum = Math.max(1, parseInt(maxDistance) || 10000)

      const { error } = await supabase
        .from('profiles')
        .update({
          min_age: minAgeNum,
          max_age: Math.max(minAgeNum, maxAgeNum),
          max_distance_km: maxDistNum,
          preferred_skills: userPlan === 'business_pro' ? selectedSkills : [],
        })
        .eq('id', session.user.id)

      if (error) throw error

      Alert.alert('Succès', 'Vos préférences ont été mises à jour')
      router.back()
    } catch (err) {
      console.error('Error saving preferences:', err)
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences')
    } finally {
      setSaving(false)
    }
  }

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const isProUser = userPlan === 'business_pro'

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Préférences de recherche</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Plan Badge */}
        <View style={styles.planBadge}>
          <Ionicons
            name={isProUser ? 'star' : 'lock-closed'}
            size={16}
            color={isProUser ? colors.primary : '#ff9800'}
          />
          <Text style={[styles.planText, { color: isProUser ? colors.primary : '#ff9800' }]}>
            {isProUser ? 'Business Pro' : 'Fonctionnalité Business Pro'}
          </Text>
        </View>

        {!isProUser && (
          <View style={styles.lockedContainer}>
            <Ionicons name="lock-closed" size={48} color="#ff980044" />
            <Text style={styles.lockedTitle}>Préférences verrouillées</Text>
            <Text style={styles.lockedText}>
              Passez à Business Pro pour filtrer les profils par âge, distance et compétences
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/settings?scroll=pro' as any)}
            >
              <Text style={styles.upgradeButtonText}>Passer à Business Pro</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.bg.primary} />
            </TouchableOpacity>
          </View>
        )}

        {isProUser && (
          <>
            {/* Age Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Âge</Text>
              <View style={styles.rangeContainer}>
                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="15"
                    placeholderTextColor={colors.text.disabled}
                    value={minAge}
                    onChangeText={setMinAge}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                <View style={styles.rangeSeparator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorText}>à</Text>
                  <View style={styles.separatorLine} />
                </View>

                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="99"
                    placeholderTextColor={colors.text.disabled}
                    value={maxAge}
                    onChangeText={setMaxAge}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>
            </View>

            {/* Distance Section */}
            <View style={styles.section}>
              <View style={styles.distanceHeader}>
                <Text style={styles.sectionTitle}>Distance max</Text>
                <Text style={styles.distanceValue}>{maxDistance} km</Text>
              </View>
              <View style={styles.distanceInputContainer}>
                <TextInput
                  style={styles.distanceInput}
                  placeholder="10000"
                  placeholderTextColor={colors.text.disabled}
                  value={maxDistance}
                  onChangeText={setMaxDistance}
                  keyboardType="number-pad"
                />
                <Text style={styles.kmUnit}>km</Text>
              </View>
              <Text style={styles.distanceHint}>
                Afficher uniquement les personnes à moins de {maxDistance} km
              </Text>
            </View>

            {/* Skills Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Compétences (optionnel)</Text>
              <Text style={styles.skillsHint}>
                Sélectionnez les compétences qui vous intéressent
              </Text>
              <View style={styles.skillsGrid}>
                {BASE_SKILLS.map((skill) => (
                  <TouchableOpacity
                    key={skill}
                    style={[
                      styles.skillTag,
                      selectedSkills.includes(skill) && styles.skillTagSelected,
                    ]}
                    onPress={() => toggleSkill(skill)}
                  >
                    {selectedSkills.includes(skill) && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.bg.primary}
                        style={styles.skillCheckmark}
                      />
                    )}
                    <Text
                      style={[
                        styles.skillName,
                        selectedSkills.includes(skill) && styles.skillNameSelected,
                      ]}
                    >
                      {skill}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.skillsCount}>
                {selectedSkills.length === 0
                  ? 'Aucune compétence sélectionnée (voir tous)'
                  : `${selectedSkills.length} compétence${selectedSkills.length > 1 ? 's' : ''} sélectionnée${selectedSkills.length > 1 ? 's' : ''}`}
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSavePreferences}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={colors.bg.primary} />
                  <Text style={styles.saveButtonText}>Enregistrer les préférences</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  title: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },

  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },

  // Plan Badge
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  planText: { fontSize: 13, fontWeight: '700', flex: 1 },

  // Locked State
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  lockedTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  lockedText: {
    color: '#ffffff88',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    marginTop: 12,
  },
  upgradeButtonText: { color: colors.bg.primary, fontSize: 14, fontWeight: '700' },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Range Inputs
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  rangeInput: { flex: 1 },
  rangeLabel: { color: '#ffffff66', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    color: colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  rangeSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#333' },
  separatorText: { color: '#ffffff66', fontSize: 12 },

  // Distance
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceValue: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  distanceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  distanceInput: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    color: colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  kmUnit: { color: '#ffffff66', fontSize: 13, fontWeight: '600', width: 30 },
  distanceHint: { color: '#ffffff66', fontSize: 12, lineHeight: 16 },

  // Skills
  skillsHint: { color: '#ffffff66', fontSize: 12, marginBottom: 12 },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  skillTagSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillCheckmark: { marginRight: 2 },
  skillName: { color: colors.text.primary, fontSize: 13, fontWeight: '600' },
  skillNameSelected: { color: colors.bg.primary },
  skillsCount: { color: '#ffffff66', fontSize: 12, fontStyle: 'italic' },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: { color: colors.bg.primary, fontSize: 14, fontWeight: '700' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})

