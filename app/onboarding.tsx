import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import * as ImagePicker from 'expo-image-picker'
import { INTERESTS, SKILLS_LIST, DEFAULT_PREFERENCES, MAX_PHOTOS } from '@/lib/utils'
import type { UserSkill } from '@/lib/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const TOTAL_STEPS = 6
// Using OpenStreetMap Nominatim - free, no API key needed, works on Android
const MAX_INTERESTS = 5

type CityResult = {
  place_id: string
  description: string
  lat: number
  lng: number
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  // Step 0
  const [firstName, setFirstName] = useState('')
  const [age, setAge] = useState('')

  // Step 1
  const [bio, setBio] = useState('')

  // Step 2
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [otherInput, setOtherInput] = useState('')

  // Step 3
  const [cityInput, setCityInput] = useState('')
  const [citySelected, setCitySelected] = useState<{ name: string; lat: number; lng: number; placeId: string } | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<CityResult[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 4
  const [selectedSkills, setSelectedSkills] = useState<UserSkill[]>([])
  const [skillSearch, setSkillSearch] = useState('')

  // Step 5
  const [photos, setPhotos] = useState<{ uri: string; base64?: string }[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const animateSlide = (direction: number, callback: () => void) => {
    Animated.timing(slideAnim, {
      toValue: -direction * SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(direction * SCREEN_WIDTH)
      callback()
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    })
  }

  const goNext = () => {
    if (!canProceed()) return
    if (step === TOTAL_STEPS - 1) {
      handleSubmit()
      return
    }
    animateSlide(1, () => setStep((s) => s + 1))
  }

  const goBack = () => {
    if (step === 0) return
    animateSlide(-1, () => setStep((s) => s - 1))
  }

  // ─── Validation ──────────────────────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return firstName.trim().length >= 2 && !!age && parseInt(age) >= 15
      case 1:
        return bio.trim().length >= 21
      case 2:
        return selectedInterests.length >= 1
      case 3:
        return citySelected !== null
      case 4:
        return true // Skills optional
      case 5:
        return photos.length >= 1
      default:
        return false
    }
  }

  // ─── Interests ───────────────────────────────────────────────────────────────
  const toggleInterest = (interest: string) => {
    const norm = interest.trim().toLowerCase()
    const already = selectedInterests.some((i) => i.toLowerCase() === norm)
    if (already) {
      setSelectedInterests((prev) => prev.filter((i) => i.toLowerCase() !== norm))
    } else if (selectedInterests.length < MAX_INTERESTS) {
      setSelectedInterests((prev) => [...prev, interest.trim()])
    }
  }

  const addCustomInterest = () => {
    const parts = otherInput.split(',').map((s) => s.trim()).filter(Boolean)
    const toAdd = parts.filter(
      (p) =>
        p.length > 0 &&
        !selectedInterests.some((i) => i.toLowerCase() === p.toLowerCase()),
    )
    const available = MAX_INTERESTS - selectedInterests.length
    setSelectedInterests((prev) => [...prev, ...toAdd.slice(0, available)])
    setOtherInput('')
  }

  // ─── City Search (OpenStreetMap Nominatim - free, no API key) ────────────────
  const searchCities = async (text: string) => {
    if (text.length < 2) {
      setCitySuggestions([])
      return
    }
    setCityLoading(true)
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&featuretype=city&accept-language=fr&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PAKT-App/1.0',
            'Accept': 'application/json',
          },
        }
      )
      const json = await resp.json()
      if (Array.isArray(json)) {
        // Filter to only cities/towns/villages and deduplicate by display name
        const seen = new Set<string>()
        const results: CityResult[] = []
        for (const p of json) {
          const name = buildCityName(p)
          if (!seen.has(name)) {
            seen.add(name)
            results.push({
              place_id: String(p.place_id),
              description: name,
              lat: parseFloat(p.lat),
              lng: parseFloat(p.lon),
            })
          }
          if (results.length >= 5) break
        }
        setCitySuggestions(results)
      }
    } catch (e) {
      console.warn('[CITY] Nominatim error:', e)
    } finally {
      setCityLoading(false)
    }
  }

  // Build a clean city name from Nominatim result
  const buildCityName = (p: any): string => {
    const addr = p.address || {}
    const city = addr.city || addr.town || addr.village || addr.municipality || p.display_name.split(',')[0]
    const country = addr.country || ''
    const state = addr.state || ''
    // Format: "Paris, Île-de-France, France"
    const parts = [city, state, country].filter(Boolean)
    return parts.slice(0, 3).join(', ')
  }

  const onCityInputChange = (text: string) => {
    setCityInput(text)
    setCitySelected(null)
    if (cityDebounce.current) clearTimeout(cityDebounce.current)
    cityDebounce.current = setTimeout(() => searchCities(text), 500)
  }

  const selectCity = (city: CityResult) => {
    setCityInput(city.description)
    setCitySuggestions([])
    setCitySelected({
      name: city.description,
      lat: city.lat,
      lng: city.lng,
      placeId: city.place_id,
    })
  }

  // ─── Skills ──────────────────────────────────────────────────────────────────
  const toggleSkill = (name: string) => {
    const already = selectedSkills.find((s) => s.name === name)
    if (already) {
      setSelectedSkills((prev) => prev.filter((s) => s.name !== name))
    } else {
      setSelectedSkills((prev) => [...prev, { name, level: 5 }])
    }
  }

  const updateSkillLevel = (name: string, level: number) => {
    setSelectedSkills((prev) =>
      prev.map((s) => (s.name === name ? { ...s, level } : s)),
    )
  }

  // ─── Photos ──────────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Maximum atteint', `Tu peux ajouter au maximum ${MAX_PHOTOS} photos.`)
      return
    }

    // Request permission
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permResult.status !== 'granted') {
      Alert.alert(
        'Permission refusée',
        "Va dans Paramètres → Applications → PAKT → Autorisations → Photos et autorise l'accès."
      )
      return
    }

    try {
      // Use MediaTypeOptions.Images (stable API across all expo-image-picker versions)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        // No base64, no allowsEditing, no selectionLimit — simplest possible config
      })

      if (result.canceled) return

      const uri = result.assets?.[0]?.uri
      if (!uri) {
        Alert.alert('Erreur', 'Impossible de récupérer la photo. Réessaie.')
        return
      }

      // Update state — triggers immediate re-render with the photo shown
      setPhotos(prev => [...prev, { uri }])

    } catch (err: any) {
      console.error('[PICKER] Error:', err)
      Alert.alert('Erreur', err?.message || 'Impossible d\'ouvrir la galerie.')
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Non connecté')

      const userId = session.user.id

      // Upload photos via fetch → blob (works on Android without base64)
      setPhotoUploading(true)
      const photoUrls: string[] = []
      for (let i = 0; i < photos.length; i++) {
        try {
          const photo = photos[i]
          const uri = photo.uri

          // Determine extension from URI or default to jpg
          const uriLower = uri.toLowerCase()
          const ext = uriLower.includes('.png') ? 'png'
            : uriLower.includes('.webp') ? 'webp'
            : 'jpg'
          const contentType = ext === 'png' ? 'image/png'
            : ext === 'webp' ? 'image/webp'
            : 'image/jpeg'

          const fileName = `${userId}/photo_${Date.now()}_${i}.${ext}`

          // Fetch the local file as a blob
          const response = await fetch(uri)
          const blob = await response.blob()

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { contentType, upsert: true })

          if (uploadError) {
            console.error('[ONBOARDING] Photo upload error:', uploadError)
          } else if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName)
            photoUrls.push(publicUrl)
          }
        } catch (uploadErr) {
          console.error('[ONBOARDING] Photo upload exception:', uploadErr)
        }
      }
      setPhotoUploading(false)

      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          first_name: firstName.trim(),
          age: parseInt(age),
          bio: bio.trim(),
          city: citySelected?.name || null,
          city_lat: citySelected?.lat || null,
          city_lng: citySelected?.lng || null,
          interests: selectedInterests,
          skills: selectedSkills,
          photos: photoUrls,
          plan: 'free',
          is_onboarded: true,
          preferences: DEFAULT_PREFERENCES,
        })

      if (profileError) throw profileError

      router.replace('/(app)/swipe' as any)
    } catch (err: any) {
      console.error('[ONBOARDING] Submit error:', err)
      Alert.alert('Erreur', err?.message || 'Impossible de créer ton profil. Réessaie.')
    } finally {
      setLoading(false)
      setPhotoUploading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepWelcome firstName={firstName} setFirstName={setFirstName} age={age} setAge={setAge} />
      case 1:
        return <StepBio bio={bio} setBio={setBio} />
      case 2:
        return (
          <StepInterests
            selectedInterests={selectedInterests}
            toggleInterest={toggleInterest}
            otherInput={otherInput}
            setOtherInput={setOtherInput}
            addCustomInterest={addCustomInterest}
          />
        )
      case 3:
        return (
          <StepCity
            cityInput={cityInput}
            onCityInputChange={onCityInputChange}
            citySuggestions={citySuggestions}
            cityLoading={cityLoading}
            citySelected={citySelected}
            selectCity={selectCity}
          />
        )
      case 4:
        return (
          <StepSkills
            selectedSkills={selectedSkills}
            toggleSkill={toggleSkill}
            updateSkillLevel={updateSkillLevel}
            skillSearch={skillSearch}
            setSkillSearch={setSkillSearch}
          />
        )
      case 5:
        return (
          <StepPhotos
            photos={photos}
            pickPhoto={pickPhoto}
            removePhoto={removePhoto}
            photoUploading={photoUploading}
          />
        )
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBack}
            disabled={step === 0}
            style={[styles.backBtn, step === 0 && { opacity: 0 }]}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{step + 1} / {TOTAL_STEPS}</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>
        </Animated.View>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.ctaButton, !canProceed() && styles.ctaDisabled]}
            onPress={goNext}
            disabled={!canProceed() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {step === TOTAL_STEPS - 1 ? 'Lancer PAKT' : 'Continuer'}
                </Text>
                {step < TOTAL_STEPS - 1 && (
                  <Ionicons name="chevron-forward" size={18} color="#000" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Step 0: Bienvenue ────────────────────────────────────────────────────────
function StepWelcome({
  firstName, setFirstName, age, setAge,
}: {
  firstName: string
  setFirstName: (v: string) => void
  age: string
  setAge: (v: string) => void
}) {
  const ageNum = parseInt(age)
  const ageTooYoung = age.length > 0 && ageNum < 15

  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Bienvenue</Text>
      <Text style={s.stepSubtitle}>Quelques infos pour commencer</Text>

      <View style={s.gap24}>
        <TextInput
          style={s.input}
          placeholder="Ton prénom"
          placeholderTextColor="#ffffff44"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoFocus
        />

        <View>
          <TextInput
            style={s.input}
            placeholder="Ton âge"
            placeholderTextColor="#ffffff44"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={s.hint}>
            En renseignant ton âge, tu déclares avoir au moins 15 ans.
          </Text>
        </View>

        {ageTooYoung && (
          <View style={s.errorBox}>
            <Text style={s.errorTitle}>Inscription impossible</Text>
            <Text style={s.errorText}>
              PAKT n'est pas accessible aux personnes de moins de 15 ans.
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Step 1: Bio ─────────────────────────────────────────────────────────────
function StepBio({ bio, setBio }: { bio: string; setBio: (v: string) => void }) {
  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Ta bio</Text>
      <Text style={s.stepSubtitle}>Présente-toi en quelques mots</Text>

      <View style={s.gap24}>
        <View>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Qui es-tu ? Quels sont tes projets ? Qu'est-ce qui te définit..."
            placeholderTextColor="#ffffff44"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <View style={s.bioMeta}>
            <Text style={s.hint}>Minimum 21 caractères</Text>
            <Text style={[s.hint, bio.length > 0 && bio.length < 21 && { color: '#ff6b6b' }]}>
              {bio.length}/500
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Step 2: Intérêts ────────────────────────────────────────────────────────
function StepInterests({
  selectedInterests, toggleInterest, otherInput, setOtherInput, addCustomInterest,
}: {
  selectedInterests: string[]
  toggleInterest: (i: string) => void
  otherInput: string
  setOtherInput: (v: string) => void
  addCustomInterest: () => void
}) {
  const maxReached = selectedInterests.length >= MAX_INTERESTS

  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Tes intérêts</Text>
      <Text style={s.stepSubtitle}>Sélectionne ce qui te correspond (max 5)</Text>

      {/* Selected */}
      {selectedInterests.length > 0 && (
        <View style={[s.chipsRow, { marginBottom: 12 }]}>
          {selectedInterests.map((interest) => (
            <TouchableOpacity
              key={interest}
              style={s.chipActive}
              onPress={() => toggleInterest(interest)}
            >
              <Text style={s.chipActiveText}>{interest}</Text>
              <Ionicons name="close" size={12} color="#000" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* All interests */}
      <View style={s.chipsRow}>
        {INTERESTS.filter((i) => i !== 'Autre').map((interest) => {
          const selected = selectedInterests.some(
            (i) => i.toLowerCase() === interest.toLowerCase(),
          )
          const disabled = maxReached && !selected
          return (
            <TouchableOpacity
              key={interest}
              style={[s.chip, selected && s.chipActive, disabled && s.chipDisabled]}
              onPress={() => !disabled && toggleInterest(interest)}
              disabled={disabled}
            >
              <Text style={[s.chipText, selected && s.chipActiveText]}>
                {interest}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Custom input */}
      <View style={{ marginTop: 16 }}>
        <View style={s.customInputRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Autre (précise...)"
            placeholderTextColor="#ffffff44"
            value={otherInput}
            onChangeText={setOtherInput}
            onSubmitEditing={addCustomInterest}
            returnKeyType="done"
            editable={!maxReached}
          />
          {otherInput.trim().length > 0 && (
            <TouchableOpacity style={s.addBtn} onPress={addCustomInterest} disabled={maxReached}>
              <Ionicons name="add" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.hint}>Sépare tes intérêts par une virgule • Maximum {MAX_INTERESTS}</Text>
      </View>
    </View>
  )
}

// ─── Step 3: Ville ───────────────────────────────────────────────────────────
function StepCity({
  cityInput, onCityInputChange, citySuggestions, cityLoading, citySelected, selectCity,
}: {
  cityInput: string
  onCityInputChange: (v: string) => void
  citySuggestions: CityResult[]
  cityLoading: boolean
  citySelected: { name: string; lat: number; lng: number; placeId: string } | null
  selectCity: (c: CityResult) => void
}) {
  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Ta ville</Text>
      <Text style={s.stepSubtitle}>Pour trouver des personnes près de toi</Text>

      <View style={{ position: 'relative', zIndex: 100 }}>
        <TextInput
          style={[s.input, citySelected && { borderColor: '#d4a853', color: '#d4a853' }]}
          placeholder="Recherche une ville..."
          placeholderTextColor="#ffffff44"
          value={cityInput}
          onChangeText={onCityInputChange}
          autoCorrect={false}
        />

        {cityLoading && (
          <ActivityIndicator
            size="small"
            color="#d4a853"
            style={{ position: 'absolute', right: 14, top: 14 }}
          />
        )}

        {/* Suggestions dropdown */}
        {citySuggestions.length > 0 && (
          <View style={s.suggestions}>
            {citySuggestions.map((city) => (
              <TouchableOpacity
                key={city.place_id}
                style={s.suggestionItem}
                onPress={() => selectCity(city)}
              >
                <Ionicons name="location-outline" size={16} color="#d4a853" />
                <Text style={s.suggestionText} numberOfLines={1}>
                  {city.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {citySelected ? (
        <View style={s.cityConfirmed}>
          <Ionicons name="checkmark-circle" size={18} color="#d4a853" />
          <Text style={s.cityConfirmedText}>Ville sélectionnée : {citySelected.name}</Text>
        </View>
      ) : cityInput.trim().length > 0 ? (
        <Text style={s.hint}>Sélectionne une ville dans la liste pour continuer.</Text>
      ) : null}
    </View>
  )
}

// ─── Step 4: Compétences ─────────────────────────────────────────────────────
function StepSkills({
  selectedSkills, toggleSkill, updateSkillLevel, skillSearch, setSkillSearch,
}: {
  selectedSkills: UserSkill[]
  toggleSkill: (name: string) => void
  updateSkillLevel: (name: string, level: number) => void
  skillSearch: string
  setSkillSearch: (v: string) => void
}) {
  const filtered = SKILLS_LIST.filter((s) =>
    s.toLowerCase().includes(skillSearch.toLowerCase()),
  )

  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Tes compétences</Text>
      <Text style={s.stepSubtitle}>
        Sélectionne uniquement celles que tu maîtrises vraiment.
      </Text>
      <Text style={[s.hint, { marginTop: -8 }]}>
        Chaque compétence nécessite un niveau honnête de 1 à 10.
      </Text>

      <TextInput
        style={s.input}
        placeholder="Rechercher une compétence..."
        placeholderTextColor="#ffffff44"
        value={skillSearch}
        onChangeText={setSkillSearch}
      />

      {/* Skill list */}
      <View style={s.chipsRow}>
        {filtered.map((skill) => {
          const selected = selectedSkills.find((s) => s.name === skill)
          return (
            <TouchableOpacity
              key={skill}
              style={[s.chip, selected && s.chipActive]}
              onPress={() => toggleSkill(skill)}
            >
              <Text style={[s.chipText, selected && s.chipActiveText]}>{skill}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Level sliders for selected skills */}
      {selectedSkills.length > 0 && (
        <View style={{ marginTop: 16, gap: 14 }}>
          <Text style={s.sectionLabel}>Niveaux</Text>
          {selectedSkills.map((skill) => (
            <View key={skill.name} style={s.skillRow}>
              <Text style={s.skillName}>{skill.name}</Text>
              <View style={s.levelDots}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => updateSkillLevel(skill.name, i + 1)}
                    style={[
                      s.levelDot,
                      i < skill.level && s.levelDotFilled,
                    ]}
                  />
                ))}
                <Text style={s.levelNum}>{skill.level}/10</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {selectedSkills.length === 0 && (
        <Text style={[s.hint, { textAlign: 'center', marginTop: 12 }]}>
          Les compétences sont optionnelles. Tu peux les ajouter plus tard.
        </Text>
      )}
    </View>
  )
}

// ─── Step 5: Photos ──────────────────────────────────────────────────────────
function StepPhotos({
  photos, pickPhoto, removePhoto, photoUploading,
}: {
  photos: { uri: string }[]
  pickPhoto: () => void
  removePhoto: (i: number) => void
  photoUploading: boolean
}) {
  // Show up to MAX_PHOTOS slots, always show at least current + 1 empty
  const slots = Array.from({ length: Math.min(MAX_PHOTOS, photos.length + 1) })

  return (
    <View style={s.stepContainer}>
      <Text style={s.stepTitle}>Tes photos</Text>
      <Text style={s.stepSubtitle}>
        Ajoute jusqu'à {MAX_PHOTOS} photos (minimum 1)
      </Text>
      <Text style={s.hint}>JPG, PNG ou WebP • Conseillé : 3/4</Text>

      {photoUploading && (
        <View style={s.uploadingRow}>
          <ActivityIndicator size="small" color="#d4a853" />
          <Text style={{ color: '#d4a853', fontSize: 13 }}>Upload des photos...</Text>
        </View>
      )}

      <View style={s.photoGrid}>
        {slots.map((_, idx) => {
          const photo = photos[idx]
          return (
            <TouchableOpacity
              key={idx}
              style={[s.photoSlot, photo && s.photoSlotFilled]}
              onPress={pickPhoto}
              activeOpacity={0.8}
            >
              {photo ? (
                <>
                  <Image source={{ uri: photo.uri }} style={s.photoImage} />
                  {idx === 0 && (
                    <View style={s.mainBadge}>
                      <Text style={s.mainBadgeText}>Principal</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={s.photoRemove}
                    onPress={(e) => { e.stopPropagation?.(); removePhoto(idx) }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <Ionicons name="add" size={28} color="rgba(255,255,255,0.3)" />
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={[s.hint, { textAlign: 'center', marginTop: 8 }]}>
        Appuie sur une case pour ajouter une photo depuis ta galerie
      </Text>
    </View>
  )
}

// ─── Base64 decoder for Supabase storage ─────────────────────────────────────
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// ─── Main Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    gap: 6,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d4a853',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ctaButton: {
    backgroundColor: '#d4a853',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaDisabled: {
    opacity: 0.35,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
})

// ─── Shared Step Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  stepContainer: {
    paddingTop: 8,
    gap: 20,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -12,
  },
  gap24: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 140,
    paddingTop: 14,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 18,
  },
  bioMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: 'rgba(255,107,107,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: {
    backgroundColor: '#d4a853',
    borderColor: '#d4a853',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 4,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  chipActiveText: {
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '700',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#d4a853',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 999,
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  cityConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cityConfirmedText: {
    color: '#d4a853',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  skillRow: {
    gap: 8,
  },
  skillName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  levelDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  levelDotFilled: {
    backgroundColor: '#d4a853',
    borderColor: '#d4a853',
  },
  levelNum: {
    color: '#d4a853',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoSlot: {
    width: (SCREEN_WIDTH - 40 - 20) / 3,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoSlotFilled: {
    borderColor: 'rgba(212,168,83,0.4)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mainBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#d4a853',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mainBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
})
