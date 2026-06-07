import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Image, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase/client'
import { profileStore } from '@/lib/profileStore'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MAX_PHOTOS = 6
const MAX_INTERESTS = 5
const MAX_SKILLS = 5
const MAX_BIO = 1000

const BASE_INTERESTS = [
  'Business', 'Tech', 'Finance', 'Marketing', 'Design',
  'Startup', 'IA', 'Voyage', 'Sport', 'Art',
  'Musique', 'Coaching', 'Networking', 'DÃ©veloppement personnel', 'Immobilier',
]
const BASE_SKILLS = [
  'Marketing', 'Vente / Closing', 'Copywriting', 'IA / Automation',
  'DÃ©veloppement Web', 'StratÃ©gie digitale', 'RÃ©seaux sociaux',
  'Montage vidÃ©o', 'Ads / Acquisition', 'SEO / Growth',
]
const LEVEL_LABELS = [
  'DÃ©butant de fou', 'DÃ©butant', 'DÃ©butant avancÃ©', 'DÃ©butant avancÃ©',
  'IntermÃ©diaire', 'IntermÃ©diaire avancÃ©', 'AvancÃ©', 'AvancÃ©', 'Expert', 'Expert / Boss',
]

interface Skill { name: string; level: number }

function getExtAndMime(asset: ImagePicker.ImagePickerAsset): { ext: string; contentType: string } {
  if (asset.mimeType) {
    const m = asset.mimeType.toLowerCase()
    if (m.includes('jpeg') || m.includes('jpg')) return { ext: 'jpg', contentType: 'image/jpeg' }
    if (m.includes('png')) return { ext: 'png', contentType: 'image/png' }
    if (m.includes('webp')) return { ext: 'webp', contentType: 'image/webp' }
    if (m.includes('heic') || m.includes('heif')) return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (asset.fileName) {
    const ext = asset.fileName.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'jpg' || ext === 'jpeg') return { ext: 'jpg', contentType: 'image/jpeg' }
    if (ext === 'png') return { ext: 'png', contentType: 'image/png' }
    if (ext === 'webp') return { ext: 'webp', contentType: 'image/webp' }
  }
  return { ext: 'jpg', contentType: 'image/jpeg' }
}

// â”€â”€â”€ Composant principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function EditProfilePage() {
  const router = useRouter()

  // â”€â”€ Ã‰tats du formulaire â”€â”€
  const [firstName, setFirstName] = useState('')
  const [age, setAge] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [interestInput, setInterestInput] = useState('')
  const [skillInput, setSkillInput] = useState('')

  // â”€â”€ Ã‰tats filtres (Business Pro seulement) â”€â”€
  const [ageMin, setAgeMin] = useState('15')
  const [ageMax, setAgeMax] = useState('99')
  const [distanceMin, setDistanceMin] = useState('0')
  const [distanceMax, setDistanceMax] = useState('1000')
  const [desiredSkills, setDesiredSkills] = useState<Skill[]>([])
  const [userPlan, setUserPlan] = useState<'free' | 'business' | 'business_pro'>('free')

  // â”€â”€ Ã‰tats UI â”€â”€
  const [uploading, setUploading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [loading, setLoading] = useState(true)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null)
  const [selectedSkillLevel, setSelectedSkillLevel] = useState(5)
  const [showDesiredSkillModal, setShowDesiredSkillModal] = useState(false)
  const [selectedDesiredSkillName, setSelectedDesiredSkillName] = useState<string | null>(null)
  const [selectedDesiredSkillLevel, setSelectedDesiredSkillLevel] = useState(5)

  // â”€â”€ Ã‰tats ville â”€â”€
  const [citySuggestions, setCitySuggestions] = useState<string[]>([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const [cityLoading, setCityLoading] = useState(false)

  // â”€â”€ Refs â”€â”€
  const profileIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const citySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = useRef(false)

  // â”€â”€â”€ Chargement initial depuis Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user || cancelled) return

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (error || !data || cancelled) return

        profileIdRef.current = data.id
        setFirstName(data.first_name || '')
        setAge(data.age ? String(data.age) : '')
        setBio(data.bio || '')
        setCity(data.city || '')
        setInterests(Array.isArray(data.interests) ? data.interests : [])
        setPhotos(Array.isArray(data.photos) ? data.photos : [])

        // Load subscription plan
        const plan = (data.subscription_plan || 'free').toLowerCase()
        setUserPlan(plan as any)

        const rawSkills = (data as any).skills
        setSkills(
          Array.isArray(rawSkills)
            ? rawSkills
                .map((s: any) => ({ name: typeof s === 'string' ? s : s?.name || '', level: typeof s?.level === 'number' ? s.level : 5 }))
                .filter((s: Skill) => Boolean(s.name))
            : []
        )

        // Load filters (Business Pro only)
        if (plan === 'business_pro') {
          const filters = (data as any).search_filters || {}
          if (filters.age_min) setAgeMin(String(filters.age_min))
          if (filters.age_max) setAgeMax(String(filters.age_max))
          if (filters.distance_min !== undefined) setDistanceMin(String(filters.distance_min))
          if (filters.distance_max !== undefined) setDistanceMax(String(filters.distance_max))

          const rawDesiredSkills = filters.desired_skills || []
          setDesiredSkills(
            Array.isArray(rawDesiredSkills)
              ? rawDesiredSkills
                  .map((s: any) => ({ name: typeof s === 'string' ? s : s?.name || '', level: typeof s?.level === 'number' ? s.level : 5 }))
                  .filter((s: Skill) => Boolean(s.name))
              : []
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // â”€â”€â”€ Sauvegarde Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const executeSave = async (data: {
    firstName: string; age: string; bio: string; city: string
    interests: string[]; skills: Skill[]; photos: string[]
    ageMin?: string; ageMax?: string; distanceMin?: string; distanceMax?: string; desiredSkills?: Skill[]
  }) => {
    const profileId = profileIdRef.current
    if (!profileId) {
      console.warn('[EDIT] executeSave: profileId is null, aborting')
      return false
    }

    // VÃ©rifier la session active avant de sauvegarder
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      console.error('[EDIT] executeSave: no active session!')
      Alert.alert('Session expirÃ©e', 'Veuillez vous reconnecter.')
      return false
    }
    if (session.user.id !== profileId) {
      console.error('[EDIT] executeSave: session user id mismatch!', { sessionId: session.user.id, profileId })
      return false
    }

    const parsedAge = data.age.trim() ? Number(data.age) : null
    const validAge = parsedAge !== null && Number.isFinite(parsedAge) ? parsedAge : null

    console.log('[EDIT] Saving to Supabase:', { firstName: data.firstName, profileId, userId: session.user.id })

    const updatePayload: any = {
      first_name: data.firstName.trim() || null,
      age: validAge,
      bio: data.bio.trim() || null,
      city: data.city.trim() || null,
      interests: data.interests.slice(0, MAX_INTERESTS),
      photos: data.photos.slice(0, MAX_PHOTOS),
      skills: data.skills.slice(0, MAX_SKILLS),
    }

    // Add filters if Business Pro
    if (userPlan === 'business_pro' && data.ageMin && data.ageMax && data.distanceMin && data.distanceMax) {
      updatePayload.search_filters = {
        age_min: parseInt(data.ageMin, 10),
        age_max: parseInt(data.ageMax, 10),
        distance_min: parseInt(data.distanceMin, 10),
        distance_max: parseInt(data.distanceMax, 10),
        desired_skills: data.desiredSkills || [],
      }
    }

    const { data: updatedRows, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profileId)
      .select()

    if (error) {
      console.error('[EDIT] Supabase save ERROR:', error.message, error.code)
      Alert.alert('Erreur', `Impossible de sauvegarder : ${error.message}`)
      return false
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error('[EDIT] Supabase save: 0 rows updated! RLS blocked or row not found.')
      Alert.alert('Erreur', 'La sauvegarde a Ã©chouÃ© (aucune ligne modifiÃ©e). VÃ©rifiez votre connexion.')
      return false
    }

    console.log('[EDIT] Supabase save SUCCESS, rows updated:', updatedRows.length, 'firstName:', data.firstName)

    // Mise Ã  jour du store global â†’ profile/index.tsx reÃ§oit les nouvelles donnÃ©es
    profileStore.set(updatedRows[0] as any)
    return true
  }

  // â”€â”€â”€ Auto-save avec debounce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const triggerAutoSave = (data: {
    firstName: string; age: string; bio: string; city: string
    interests: string[]; skills: Skill[]; photos: string[]
    ageMin?: string; ageMax?: string; distanceMin?: string; distanceMax?: string; desiredSkills?: Skill[]
  }) => {
    if (!isDirtyRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const ok = await executeSave(data)
      setSaveStatus(ok ? 'saved' : 'idle')
      if (ok) setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }

  // â”€â”€â”€ Handlers champs texte â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onFirstNameChange = (v: string) => {
    isDirtyRef.current = true
    setFirstName(v)
    triggerAutoSave({ firstName: v, age, bio, city, interests, skills, photos })
  }
  const onAgeChange = (v: string) => {
    isDirtyRef.current = true
    setAge(v)
    triggerAutoSave({ firstName, age: v, bio, city, interests, skills, photos })
  }
  const onBioChange = (v: string) => {
    isDirtyRef.current = true
    setBio(v)
    triggerAutoSave({ firstName, age, bio: v, city, interests, skills, photos })
  }
  // â”€â”€â”€ Suggestions de villes (Nominatim / OpenStreetMap) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchCitySuggestions = async (query: string) => {
    if (query.length < 2) {
      setCitySuggestions([])
      setShowCitySuggestions(false)
      return
    }
    setCityLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=7&featuretype=city&accept-language=fr`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PAKT-App/1.0 contact@pakt.app' },
      })
      const results: any[] = await res.json()
      const seen = new Set<string>()
      const cities: string[] = []
      for (const r of results) {
        const addr = r.address || {}
        const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || r.name
        const country = addr.country
        if (!cityName) continue
        const label = country ? `${cityName}, ${country}` : cityName
        if (!seen.has(label)) {
          seen.add(label)
          cities.push(label)
        }
        if (cities.length >= 5) break
      }
      setCitySuggestions(cities)
      setShowCitySuggestions(cities.length > 0)
    } catch {
      setCitySuggestions([])
      setShowCitySuggestions(false)
    } finally {
      setCityLoading(false)
    }
  }

  const onCityChange = (v: string) => {
    isDirtyRef.current = true
    setCity(v)
    setShowCitySuggestions(false)
    triggerAutoSave({ firstName, age, bio, city: v, interests, skills, photos })
    if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current)
    citySearchTimerRef.current = setTimeout(() => fetchCitySuggestions(v), 350)
  }

  const selectCity = (label: string) => {
    // Ne garder que la partie avant la virgule (nom de la ville sans le pays)
    const cityOnly = label.split(',')[0].trim()
    isDirtyRef.current = true
    setCity(cityOnly)
    setCitySuggestions([])
    setShowCitySuggestions(false)
    triggerAutoSave({ firstName, age, bio, city: cityOnly, interests, skills, photos })
  }

  // â”€â”€â”€ Handlers intÃ©rÃªts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addInterest = (name: string) => {
    if (!name || interests.includes(name) || interests.length >= MAX_INTERESTS) return
    const next = [...interests, name]
    isDirtyRef.current = true
    setInterests(next)
    triggerAutoSave({ firstName, age, bio, city, interests: next, skills, photos })
  }
  const removeInterest = (i: number) => {
    const next = interests.filter((_, idx) => idx !== i)
    isDirtyRef.current = true
    setInterests(next)
    triggerAutoSave({ firstName, age, bio, city, interests: next, skills, photos })
  }
  const addInterestCustom = () => {
    const v = interestInput.trim()
    if (v) { addInterest(v); setInterestInput('') }
  }

  // â”€â”€â”€ Handlers compÃ©tences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addSkill = () => {
    if (!selectedSkillName || skills.length >= MAX_SKILLS) return
    if (skills.some(s => s.name === selectedSkillName)) return
    const next = [...skills, { name: selectedSkillName, level: selectedSkillLevel }]
    isDirtyRef.current = true
    setSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills: next, photos })
    setSelectedSkillName(null); setSelectedSkillLevel(5); setShowSkillModal(false)
  }
  const addSkillCustom = () => {
    const v = skillInput.trim()
    if (!v || skills.length >= MAX_SKILLS || skills.some(s => s.name === v)) return
    const next = [...skills, { name: v, level: 5 }]
    isDirtyRef.current = true
    setSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills: next, photos })
    setSkillInput('')
  }
  const removeSkill = (idx: number) => {
    const next = skills.filter((_, i) => i !== idx)
    isDirtyRef.current = true
    setSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills: next, photos })
  }
  const updateSkillLevel = (idx: number, level: number) => {
    const next = skills.map((s, i) => i === idx ? { ...s, level } : s)
    isDirtyRef.current = true
    setSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills: next, photos })
  }

  // â”€â”€â”€ Handlers filtres (Business Pro) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addDesiredSkill = () => {
    if (!selectedDesiredSkillName || desiredSkills.length >= MAX_SKILLS) return
    if (desiredSkills.some(s => s.name === selectedDesiredSkillName)) return
    const next = [...desiredSkills, { name: selectedDesiredSkillName, level: selectedDesiredSkillLevel }]
    isDirtyRef.current = true
    setDesiredSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax, distanceMin, distanceMax, desiredSkills: next })
    setSelectedDesiredSkillName(null); setSelectedDesiredSkillLevel(5); setShowDesiredSkillModal(false)
  }
  const removeDesiredSkill = (idx: number) => {
    const next = desiredSkills.filter((_, i) => i !== idx)
    isDirtyRef.current = true
    setDesiredSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax, distanceMin, distanceMax, desiredSkills: next })
  }
  const updateDesiredSkillLevel = (idx: number, level: number) => {
    const next = desiredSkills.map((s, i) => i === idx ? { ...s, level } : s)
    isDirtyRef.current = true
    setDesiredSkills(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax, distanceMin, distanceMax, desiredSkills: next })
  }

  // â”€â”€â”€ Handler photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite atteinte', `Maximum ${MAX_PHOTOS} photos.`); return
    }
    try {
      const isWeb = typeof document !== 'undefined'
      if (!isWeb) {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) { Alert.alert('Permission refusÃ©e'); return }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // â† false fixes "Network request failed" on Android
        quality: 0.85,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      if (!asset.uri) { Alert.alert('Erreur', 'URI invalide'); return }
      setUploading(true)
      const { ext, contentType } = getExtAndMime(asset)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { Alert.alert('Session expirÃ©e'); setUploading(false); return }
      // Use expo-file-system to handle Android content:// URIs
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const binaryString = atob(base64)
      const byteArray = new Uint8Array(binaryString.length)
      for (let j = 0; j < binaryString.length; j++) byteArray[j] = binaryString.charCodeAt(j)
      if (byteArray.length === 0) { Alert.alert('Erreur', 'Fichier vide'); setUploading(false); return }
      if (byteArray.length > 10 * 1024 * 1024) { Alert.alert('Trop volumineux', 'Max 10MB'); setUploading(false); return }
      const fileName = `${session.user.id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('avatars').upload(fileName, byteArray, { contentType })
      if (uploadErr) { Alert.alert('Erreur upload', uploadErr.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path)
      if (!urlData?.publicUrl) { Alert.alert('Erreur URL'); setUploading(false); return }
      const next = [...photos, urlData.publicUrl]
      isDirtyRef.current = true
      setPhotos(next)
      triggerAutoSave({ firstName, age, bio, city, interests, skills, photos: next })
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de charger la photo.')
    } finally {
      setUploading(false)
    }
  }
  const removePhoto = (i: number) => {
    const next = photos.filter((_, idx) => idx !== i)
    isDirtyRef.current = true
    setPhotos(next)
    triggerAutoSave({ firstName, age, bio, city, interests, skills, photos: next })
  }

  // â”€â”€â”€ Retour en arriÃ¨re â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBack = async () => {
    if (uploading) {
      Alert.alert('Veuillez patienter', 'Upload en coursâ€¦'); return
    }
    // Annuler le debounce en cours
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }

    // Sauvegarder immÃ©diatement si des modifications existent
    if (isDirtyRef.current && profileIdRef.current) {
      setSaveStatus('saving')
      await executeSave({ firstName, age, bio, city, interests, skills, photos })
      setSaveStatus('idle')
    }

    // Toujours utiliser replace pour forcer un refresh de /profile
    router.replace('/profile' as any)
  }

  // â”€â”€â”€ Affichage chargement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const availableInterests = BASE_INTERESTS.filter(i => !interests.includes(i))
  const availableSkills = BASE_SKILLS.filter(s => !skills.some(sk => sk.name === s))

  // â”€â”€â”€ Rendu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={16} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier mon profil</Text>
        <View style={styles.savingIndicator}>
          {saveStatus === 'saving' && <ActivityIndicator size="small" color={colors.primary} />}
          {saveStatus === 'saved' && <Text style={styles.savedText}>SauvegardÃ©</Text>}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Photos */}
        <Text style={styles.sectionLabel}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={{ paddingRight: 16 }}>
          {photos.map((p, idx) => (
            <View key={`photo-${idx}`} style={styles.photoCell}>
              <Image source={{ uri: p }} style={styles.photoCellImg} resizeMode="cover" />
              <TouchableOpacity style={styles.photoCellRemove} onPress={() => removePhoto(idx)} hitSlop={6}>
                <Ionicons name="close-circle" size={26} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={[styles.photoCell, styles.photoCellAdd]} onPress={pickPhoto} disabled={uploading} activeOpacity={0.7}>
              {uploading
                ? <ActivityIndicator size="large" color={colors.primary} />
                : <><Ionicons name="add" size={36} color={colors.primary} /><Text style={styles.photoCellAddText}>Ajouter</Text></>
              }
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* PrÃ©nom */}
        <Text style={styles.sectionLabel}>PrÃ©nom</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={onFirstNameChange} placeholder="Ton prÃ©nom" placeholderTextColor="#555" />

        {/* Ã‚ge */}
        <Text style={styles.sectionLabel}>Ã‚ge</Text>
        <TextInput style={styles.input} value={age} onChangeText={onAgeChange} placeholder="25" placeholderTextColor="#555" keyboardType="number-pad" maxLength={3} />

        {/* Ville */}
        <Text style={styles.sectionLabel}>Ville</Text>
        <View style={{ marginBottom: showCitySuggestions ? 0 : 12 }}>
          <View style={[styles.cityInputWrap, showCitySuggestions && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: `${colors.primary}55` }]}>
            <Ionicons name="location-outline" size={16} color={colors.primary} style={styles.cityIcon} />
            <TextInput
              style={styles.cityInput}
              value={city}
              onChangeText={onCityChange}
              placeholder="Paris, Lyon, Marseille..."
              placeholderTextColor="#555"
              onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
              onFocus={() => city.length >= 2 && citySuggestions.length > 0 && setShowCitySuggestions(true)}
            />
            {cityLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 10 }} />}
            {city.length > 0 && !cityLoading && (
              <TouchableOpacity onPress={() => { setCity(''); setCitySuggestions([]); setShowCitySuggestions(false) }} hitSlop={10} style={{ marginRight: 10 }}>
                <Ionicons name="close-circle" size={18} color="#555" />
              </TouchableOpacity>
            )}
          </View>
          {showCitySuggestions && citySuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {citySuggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.suggestionRow, idx < citySuggestions.length - 1 && styles.suggestionRowBorder]}
                  onPress={() => selectCity(suggestion)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="location" size={14} color={colors.primary} style={{ marginRight: 8, flexShrink: 0 }} />
                  <Text style={styles.suggestionText} numberOfLines={1}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bio */}
        <Text style={styles.sectionLabel}>Bio</Text>
        <TextInput style={[styles.input, styles.textarea]} value={bio} onChangeText={onBioChange} placeholder="Parle un peu de toi..." placeholderTextColor="#555" multiline maxLength={MAX_BIO} />
        <Text style={styles.counter}>{bio.length}/{MAX_BIO}</Text>

        {/* IntÃ©rÃªts */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>IntÃ©rÃªts ({interests.length}/{MAX_INTERESTS})</Text>
        <View style={styles.bubblesRow}>
          {availableInterests.map(interest => (
            <TouchableOpacity key={interest} style={styles.bubbleInterest} onPress={() => addInterest(interest)}>
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.bubbleText}>{interest}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={interestInput} onChangeText={setInterestInput} placeholder="IntÃ©rÃªt personnalisÃ©..." placeholderTextColor="#555" returnKeyType="done" onSubmitEditing={addInterestCustom} />
          <TouchableOpacity style={[styles.addBtn, interests.length >= MAX_INTERESTS && styles.addBtnDisabled]} onPress={addInterestCustom} disabled={interests.length >= MAX_INTERESTS}>
            <Ionicons name="add" size={20} color={colors.bg.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.tagsRow}>
          {interests.map((it, idx) => (
            <TouchableOpacity key={`int-${idx}`} style={styles.tagActive} onPress={() => removeInterest(idx)}>
              <Text style={styles.tagActiveText}>{it}</Text>
              <Ionicons name="close" size={13} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CompÃ©tences */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>CompÃ©tences ({skills.length}/{MAX_SKILLS})</Text>
        <View style={styles.bubblesRow}>
          {availableSkills.map(skill => (
            <TouchableOpacity key={skill} style={styles.bubbleSkill} onPress={() => { setSelectedSkillName(skill); setSelectedSkillLevel(5); setShowSkillModal(true) }}>
              <Ionicons name="add-circle-outline" size={14} color="#aaa" />
              <Text style={styles.bubbleText}>{skill}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={skillInput} onChangeText={setSkillInput} placeholder="CompÃ©tence personnalisÃ©e..." placeholderTextColor="#555" returnKeyType="done" onSubmitEditing={addSkillCustom} />
          <TouchableOpacity style={[styles.addBtn, skills.length >= MAX_SKILLS && styles.addBtnDisabled]} onPress={addSkillCustom} disabled={skills.length >= MAX_SKILLS}>
            <Ionicons name="add" size={20} color={colors.bg.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.skillCards}>
          {skills.map((skill, idx) => (
            <View key={`sk-${idx}`} style={styles.skillCard}>
              <View style={styles.skillCardHeader}>
                <Text style={styles.skillCardName}>{skill.name}</Text>
                <TouchableOpacity onPress={() => removeSkill(idx)} hitSlop={10}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.levelLabel}>Niveau : <Text style={styles.levelValue}>{skill.level}/10</Text></Text>
              <View style={styles.levelBtns}>
                {[1,2,3,4,5,6,7,8,9,10].map(lv => (
                  <TouchableOpacity key={lv} style={[styles.levelBtn, skill.level === lv && styles.levelBtnOn]} onPress={() => updateSkillLevel(idx, lv)}>
                    <Text style={[styles.levelBtnTxt, skill.level === lv && styles.levelBtnTxtOn]}>{lv}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.levelDesc}>{LEVEL_LABELS[skill.level - 1]}</Text>
            </View>
          ))}
        </View>

        {/* FILTRES - Visible pour TOUS (avec cadenas pour non-Business Pro) */}
        <View style={{ position: 'relative' }}>
          <View style={[{ opacity: userPlan === 'business_pro' ? 1 : 0.5 }]}>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Filtres de recherche</Text>
            <Text style={styles.filterInfo}>Personnalisez qui vous voulez rencontrer</Text>

            {/* Ã‚ge */}
            <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>Ã‚ge: {ageMin} - {ageMax} ans</Text>
            <View style={styles.rangeRow}>
              <TextInput
                editable={userPlan === 'business_pro'}
                style={[styles.rangeInput, { flex: 1, marginRight: 8 }]}
                value={ageMin}
                onChangeText={(v) => { setAgeMin(v); isDirtyRef.current = true; triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin: v, ageMax, distanceMin, distanceMax, desiredSkills }) }}
                placeholder="15"
                keyboardType="number-pad"
              />
              <TextInput
                editable={userPlan === 'business_pro'}
                style={[styles.rangeInput, { flex: 1 }]}
                value={ageMax}
                onChangeText={(v) => { setAgeMax(v); isDirtyRef.current = true; triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax: v, distanceMin, distanceMax, desiredSkills }) }}
                placeholder="99"
                keyboardType="number-pad"
              />
            </View>

            {/* Distance */}
            <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>Localisation: {distanceMin} - {distanceMax === '1000' ? 'âˆž' : distanceMax} km</Text>
            <View style={styles.rangeRow}>
              <TextInput
                editable={userPlan === 'business_pro'}
                style={[styles.rangeInput, { flex: 1, marginRight: 8 }]}
                value={distanceMin}
                onChangeText={(v) => { setDistanceMin(v); isDirtyRef.current = true; triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax, distanceMin: v, distanceMax, desiredSkills }) }}
                placeholder="0"
                keyboardType="number-pad"
              />
              <TextInput
                editable={userPlan === 'business_pro'}
                style={[styles.rangeInput, { flex: 1 }]}
                value={distanceMax}
                onChangeText={(v) => { setDistanceMax(v); isDirtyRef.current = true; triggerAutoSave({ firstName, age, bio, city, interests, skills, photos, ageMin, ageMax, distanceMin, distanceMax: v, desiredSkills }) }}
                placeholder="1000"
                keyboardType="number-pad"
              />
            </View>

            {/* CompÃ©tences recherchÃ©es */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>CompÃ©tences recherchÃ©es ({desiredSkills.length}/{MAX_SKILLS})</Text>
            <View style={styles.bubblesRow}>
              {BASE_SKILLS.filter(s => !desiredSkills.some(ds => ds.name === s)).map(skill => (
                <TouchableOpacity
                  key={skill}
                  style={styles.bubbleSkill}
                  onPress={() => { if (userPlan === 'business_pro') { setSelectedDesiredSkillName(skill); setSelectedDesiredSkillLevel(5); setShowDesiredSkillModal(true) } }}
                  disabled={userPlan !== 'business_pro'}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#aaa" />
                  <Text style={styles.bubbleText}>{skill}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.skillCards}>
              {desiredSkills.map((skill, idx) => (
                <View key={`desired-sk-${idx}`} style={styles.skillCard}>
                  <View style={styles.skillCardHeader}>
                    <Text style={styles.skillCardName}>{skill.name}</Text>
                    <TouchableOpacity
                      onPress={() => { if (userPlan === 'business_pro') removeDesiredSkill(idx) }}
                      hitSlop={10}
                      disabled={userPlan !== 'business_pro'}
                    >
                      <Ionicons name="close-circle" size={20} color={userPlan === 'business_pro' ? '#ef4444' : '#666'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.levelLabel}>Niveau minimum: <Text style={styles.levelValue}>{skill.level}/10</Text></Text>
                  <View style={styles.levelBtns}>
                    {[1,2,3,4,5,6,7,8,9,10].map(lv => (
                      <TouchableOpacity
                        key={lv}
                        style={[styles.levelBtn, skill.level === lv && styles.levelBtnOn]}
                        onPress={() => { if (userPlan === 'business_pro') updateDesiredSkillLevel(idx, lv) }}
                        disabled={userPlan !== 'business_pro'}
                      >
                        <Text style={[styles.levelBtnTxt, skill.level === lv && styles.levelBtnTxtOn]}>{lv}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.levelDesc}>{LEVEL_LABELS[skill.level - 1]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Cadenas + Bandeau pour non-Business Pro */}
          {userPlan !== 'business_pro' && (
            <View style={styles.filterLockedOverlay}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
              <Text style={styles.filterLockedText}>Filtres avancÃ©s</Text>
              <Text style={styles.filterLockedSubtext}>RÃ©servÃ© aux Business Pro</Text>
              <TouchableOpacity style={styles.filterUnlockBtn} onPress={() => router.push('/settings?scroll=pro' as any)}>
                <Text style={styles.filterUnlockBtnText}>DÃ©couvrir Business Pro</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal compÃ©tence */}
      <Modal visible={showSkillModal} transparent animationType="slide" onRequestClose={() => setShowSkillModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>Ajouter une compÃ©tence</Text>
              <TouchableOpacity onPress={() => setShowSkillModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {selectedSkillName && (
              <>
                <Text style={styles.modalSkillName}>{selectedSkillName}</Text>
                <Text style={styles.levelLabel}>Niveau : <Text style={styles.levelValue}>{selectedSkillLevel}/10</Text></Text>
                <View style={[styles.levelBtns, { marginTop: 12 }]}>
                  {[1,2,3,4,5,6,7,8,9,10].map(lv => (
                    <TouchableOpacity key={lv} style={[styles.levelBtn, selectedSkillLevel === lv && styles.levelBtnOn]} onPress={() => setSelectedSkillLevel(lv)}>
                      <Text style={[styles.levelBtnTxt, selectedSkillLevel === lv && styles.levelBtnTxtOn]}>{lv}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.levelDesc, { marginBottom: 20 }]}>{LEVEL_LABELS[selectedSkillLevel - 1]}</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={addSkill}>
                  <Text style={styles.confirmBtnTxt}>Ajouter</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal compÃ©tence recherchÃ©e (Business Pro) */}
      <Modal visible={showDesiredSkillModal} transparent animationType="slide" onRequestClose={() => setShowDesiredSkillModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>CompÃ©tence recherchÃ©e</Text>
              <TouchableOpacity onPress={() => setShowDesiredSkillModal(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {selectedDesiredSkillName && (
              <>
                <Text style={styles.modalSkillName}>{selectedDesiredSkillName}</Text>
                <Text style={styles.levelLabel}>Niveau minimum : <Text style={styles.levelValue}>{selectedDesiredSkillLevel}/10</Text></Text>
                <View style={[styles.levelBtns, { marginTop: 12 }]}>
                  {[1,2,3,4,5,6,7,8,9,10].map(lv => (
                    <TouchableOpacity key={lv} style={[styles.levelBtn, selectedDesiredSkillLevel === lv && styles.levelBtnOn]} onPress={() => setSelectedDesiredSkillLevel(lv)}>
                      <Text style={[styles.levelBtnTxt, selectedDesiredSkillLevel === lv && styles.levelBtnTxtOn]}>{lv}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.levelDesc, { marginBottom: 20 }]}>{LEVEL_LABELS[selectedDesiredSkillLevel - 1]}</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={addDesiredSkill}>
                  <Text style={styles.confirmBtnTxt}>Ajouter</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal upload photo */}
      <Modal visible={uploading} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.uploadModalBg}>
          <View style={styles.uploadModalBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.uploadModalText}>Veuillez patienter</Text>
            <Text style={styles.uploadModalSubtext}>Votre profil est en cours de modification</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.bg.tertiary },
  backBtn: { padding: 4 },
  headerTitle: { color: colors.text.primary, fontSize: 17, fontWeight: '700' },
  savingIndicator: { width: 80, alignItems: 'flex-end' },
  savedText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  sectionLabel: { color: colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 10 },
  carousel: { height: 200, marginBottom: 16 },
  photoCell: { width: 140, height: 190, marginRight: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.bg.quaternary, position: 'relative' },
  photoCellImg: { width: '100%', height: '100%' },
  photoCellRemove: { position: 'absolute', top: 6, right: 6 },
  photoCellAdd: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: `${colors.primary}55`, borderWidth: 1, backgroundColor: `${colors.primary}08`, gap: 6 },
  photoCellAddText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#141414', borderColor: colors.bg.quaternary, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text.primary, fontSize: 15, marginBottom: 12 },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
  counter: { color: '#ffffff33', fontSize: 11, textAlign: 'right', marginBottom: 4 },
  bubblesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  bubbleInterest: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}66`, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleSkill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg.tertiary, borderColor: '#333', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  bubbleText: { color: '#ddd', fontSize: 12, fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addBtn: { width: 46, height: 46, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: '#555' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tagActive: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${colors.primary}18`, borderColor: colors.primary, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagActiveText: { color: colors.primary, fontSize: 13, fontWeight: '500' },
  skillCards: { marginTop: 4, gap: 10, marginBottom: 16 },
  skillCard: { backgroundColor: '#141414', borderColor: colors.bg.quaternary, borderWidth: 1, borderRadius: 12, padding: 14 },
  skillCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  skillCardName: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
  levelLabel: { color: '#aaa', fontSize: 13, marginBottom: 8 },
  levelValue: { color: colors.primary, fontWeight: '700' },
  levelBtns: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  levelBtn: { flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: '#1e1e1e', borderColor: '#333', borderWidth: 1, alignItems: 'center' },
  levelBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelBtnTxt: { color: '#888', fontSize: 10, fontWeight: '700' },
  levelBtnTxtOn: { color: colors.bg.primary },
  levelDesc: { color: '#666', fontSize: 12 },
  filterInfo: { color: '#ffffff66', fontSize: 13, marginBottom: 12 },
  rangeRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  rangeInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.bg.quaternary, borderRadius: 8, color: colors.text.primary, fontSize: 14 },
  filterLockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  filterLockedText: { color: colors.primary, fontSize: 16, fontWeight: '700', marginTop: 12 },
  filterLockedSubtext: { color: '#ffffff88', fontSize: 13, marginTop: 6, textAlign: 'center' },
  filterUnlockBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  filterUnlockBtnText: { color: colors.bg.primary, fontWeight: '700', fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: colors.bg.quaternary },
  modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
  modalSkillName: { color: colors.primary, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnTxt: { color: colors.bg.primary, fontSize: 16, fontWeight: '700' },
  uploadModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  uploadModalBox: { backgroundColor: '#141414', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.bg.quaternary },
  uploadModalText: { color: colors.text.primary, fontSize: 16, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  uploadModalSubtext: { color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center' },
  cityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderColor: colors.bg.quaternary,
    borderWidth: 1,
    borderRadius: 10,
  },
  cityIcon: { marginLeft: 12, marginRight: 2, flexShrink: 0 },
  cityInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    color: colors.text.primary,
    fontSize: 15,
  },
  suggestionsBox: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: `${colors.primary}55`,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.quaternary,
  },
  suggestionText: {
    color: colors.text.primary,
    fontSize: 14,
    flex: 1,
  },
})

