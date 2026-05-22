import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { INTERESTS, MAX_PHOTOS, SKILLS_LIST, DEFAULT_PREFERENCES } from '@/lib/utils';
import type { Profile, UserSkill } from '@/lib/types';

const STEPS = 6;
const MAX_INTERESTS = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { setProfile } = useAppStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [cityLat, setCityLat] = useState<number | null>(null);
  const [cityLng, setCityLng] = useState<number | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<UserSkill[]>([]);

  const progress = ((step + 1) / STEPS) * 100;

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, interest];
    });
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills((prev) => {
      const exists = prev.find((s) => s.name === skillName);
      if (exists) return prev.filter((s) => s.name !== skillName);
      return [...prev, { name: skillName, level: 5 }];
    });
  };

  const updateSkillLevel = (skillName: string, level: number) => {
    setSelectedSkills((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, level } : s)),
    );
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return firstName.trim() && age && parseInt(age) >= 15;
      case 1:
        return bio.trim().length >= 21;
      case 2:
        return selectedInterests.length > 0;
      case 3:
        return city.trim().length > 0;
      case 4:
        return true;
      case 5:
        return photos.length >= 1;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    setLoading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const photoUri of photos) {
        const ext = photoUri.split('.').pop() || 'jpg';
        const fileName = `${session.user.id}/${Date.now()}.${ext}`;

        const response = await fetch(photoUri);
        const blob = await response.blob();

        const { data: uploadData, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: `image/${ext}` });

        if (error) throw error;

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);

        uploadedUrls.push(publicUrl);
      }

      const profilePayload = {
        id: session.user.id,
        email: session.user.email!,
        first_name: firstName,
        age: parseInt(age),
        bio,
        interests: selectedInterests,
        city,
        city_lat: cityLat,
        city_lng: cityLng,
        photos: uploadedUrls,
        skills: selectedSkills.filter((s) => s.level >= 1),
        is_onboarded: true,
        email_confirmed: true,
        plan: 'free',
        preferences: DEFAULT_PREFERENCES,
      };

      const { error, data } = await supabase
        .from('profiles')
        .upsert(profilePayload as any)
        .select('*')
        .single();

      if (error) throw error;

      setProfile(data as unknown as Profile);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Erreur lors de la creation du profil');
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!canProceed()) return;
    if (step === STEPS - 1) {
      handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity onPress={goPrev} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.stepText}>
          {step + 1} / {STEPS}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Bienvenue</Text>
            <Text style={styles.subtitle}>Quelques infos pour commencer</Text>

            <TextInput
              style={styles.input}
              placeholder="Ton prenom"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Ton age"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            {age && parseInt(age) < 15 && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Inscription impossible</Text>
                <Text style={styles.errorText}>
                  PAKT n'est pas accessible aux personnes de moins de 15 ans.
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Ta bio</Text>
            <Text style={styles.subtitle}>Presente-toi en quelques mots</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Qui es-tu ? Quels sont tes projets ?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Tes interets</Text>
            <Text style={styles.subtitle}>Selectionne ce qui te correspond (5 max)</Text>

            <View style={styles.chipsContainer}>
              {INTERESTS.filter((i) => i !== 'Autre').map((interest) => {
                const selected = selectedInterests.includes(interest);
                const disabled = !selected && selectedInterests.length >= MAX_INTERESTS;
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.chip,
                      selected && styles.chipSelected,
                      disabled && styles.chipDisabled,
                    ]}
                    onPress={() => toggleInterest(interest)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Ta ville</Text>
            <Text style={styles.subtitle}>
              Pour trouver des personnes pres de toi
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Paris, Lyon, Bordeaux..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={city}
              onChangeText={setCity}
              autoFocus
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Tes competences</Text>
            <Text style={styles.subtitle}>
              Selectionne uniquement celles que tu maitrises vraiment
            </Text>

            {SKILLS_LIST.map((skillName) => {
              const skill = selectedSkills.find((s) => s.name === skillName);
              const isSelected = !!skill;
              return (
                <View key={skillName}>
                  <TouchableOpacity
                    style={[
                      styles.skillRow,
                      isSelected && styles.skillRowSelected,
                    ]}
                    onPress={() => toggleSkill(skillName)}
                  >
                    <Text
                      style={[
                        styles.skillName,
                        isSelected && styles.skillNameSelected,
                      ]}
                    >
                      {skillName}
                    </Text>
                    {isSelected && (
                      <Text style={styles.skillLevel}>{skill!.level}/10</Text>
                    )}
                  </TouchableOpacity>
                  {isSelected && (
                    <View style={styles.sliderContainer}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[
                            styles.levelDot,
                            n <= skill!.level && styles.levelDotActive,
                          ]}
                          onPress={() => updateSkillLevel(skillName, n)}
                        >
                          <Text
                            style={[
                              styles.levelDotText,
                              n <= skill!.level && styles.levelDotTextActive,
                            ]}
                          >
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Tes photos</Text>
            <Text style={styles.subtitle}>
              Ajoute jusqu'a {MAX_PHOTOS} photos (min 1)
            </Text>

            <View style={styles.photosGrid}>
              {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
                const uri = photos[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.photoSlot}
                    onPress={() => (uri ? removePhoto(idx) : pickPhoto())}
                  >
                    {uri ? (
                      <>
                        <Image source={{ uri }} style={styles.photoImage} />
                        <View style={styles.photoRemove}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </View>
                        {idx === 0 && (
                          <View style={styles.photoPrimary}>
                            <Text style={styles.photoPrimaryText}>Principal</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Ionicons
                        name="add"
                        size={24}
                        color="rgba(255,255,255,0.3)"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!canProceed() || loading) && styles.nextButtonDisabled,
          ]}
          onPress={goNext}
          disabled={!canProceed() || loading}
        >
          <Text style={styles.nextButtonText}>
            {loading
              ? 'Creation du profil...'
              : step === STEPS - 1
                ? 'Lancer PAKT'
                : 'Continuer'}
          </Text>
          {!loading && step < STEPS - 1 && (
            <Ionicons name="chevron-forward" size={18} color={Colors.dark} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  progressContainer: {
    height: 3,
    backgroundColor: Colors.dark400,
    marginTop: Platform.OS === 'ios' ? 56 : 32,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContent: {
    gap: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark200,
    borderWidth: 1,
    borderColor: Colors.dark400,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 160,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'right',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark300,
    borderWidth: 1,
    borderColor: Colors.dark500,
  },
  chipSelected: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.dark,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark200,
    borderWidth: 1,
    borderColor: Colors.dark400,
    marginBottom: 4,
  },
  skillRowSelected: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,83,0.08)',
  },
  skillName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  skillNameSelected: {
    color: Colors.gold,
  },
  skillLevel: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  levelDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelDotActive: {
    backgroundColor: Colors.gold,
  },
  levelDotText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  levelDotTextActive: {
    color: Colors.dark,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoSlot: {
    width: (SCREEN_WIDTH - 48 - 16) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.dark200,
    borderWidth: 1,
    borderColor: Colors.dark400,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPrimary: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoPrimaryText: {
    color: Colors.dark,
    fontSize: 9,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  errorTitle: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: 'rgba(252,165,165,0.8)',
    fontSize: 12,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 16,
  },
  nextButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: Colors.dark,
    fontSize: 16,
    fontWeight: '700',
  },
});
