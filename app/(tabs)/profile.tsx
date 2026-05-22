import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { USE_MOCK_DATA } from '@/lib/config';
import { Colors } from '@/constants/theme';
import {
  INTERESTS,
  SKILLS_LIST,
  MAX_PHOTOS,
  parseSkills,
  cleanPhotoUrls,
  normalizePlan,
} from '@/lib/utils';
import type { Profile, UserSkill } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 40 - 16) / 3;

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, setProfile } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const plan = normalizePlan(profile?.plan);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setAge(profile.age ? String(profile.age) : '');
      setBio(profile.bio || '');
      setCity(profile.city || '');
      setInterests(Array.isArray(profile.interests) ? profile.interests : []);
      setSkills(parseSkills(profile.skills));
      setPhotos(cleanPhotoUrls(profile.photos));
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const updates: any = {
        first_name: firstName.trim(),
        age: age ? parseInt(age, 10) : null,
        bio: bio.trim(),
        city: city.trim(),
        interests,
        skills,
        photos,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, ...updates } as Profile);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Maximum atteint', `Tu peux avoir ${MAX_PHOTOS} photos maximum.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() || 'jpg';
    const fileName = `${profile!.id}/${Date.now()}.${ext}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, { contentType: `image/${ext}` });

    if (uploadError) {
      Alert.alert('Erreur', 'Erreur upload photo');
      return;
    }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    setPhotos((prev) => [...prev, urlData.publicUrl]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= 5) return prev;
      return [...prev, interest];
    });
  };

  const updateSkillLevel = (name: string, level: number) => {
    setSkills((prev) => {
      const existing = prev.find((s) => s.name === name);
      if (existing) {
        if (level === 0) return prev.filter((s) => s.name !== name);
        return prev.map((s) => (s.name === name ? { ...s, level } : s));
      }
      if (level > 0) return [...prev, { name, level }];
      return prev;
    });
  };

  if (!profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Profil</Text>
        {editing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? '...' : 'Sauvegarder'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={Colors.gold} />
            <Text style={styles.editText}>Modifier</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              {editing && (
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {editing && photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}>
              <Ionicons name="add" size={28} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Basic info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Prenom</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <Text style={styles.value}>{firstName || '-'}</Text>
          )}
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Age</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <Text style={styles.value}>{age || '-'}</Text>
          )}
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Ville</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <Text style={styles.value}>{city || '-'}</Text>
          )}
        </View>
      </View>

      {/* Bio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bio</Text>
        {editing ? (
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            placeholderTextColor="rgba(255,255,255,0.3)"
            placeholder="Parle de toi..."
          />
        ) : (
          <Text style={styles.bioText}>{bio || 'Aucune bio'}</Text>
        )}
      </View>

      {/* Interests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Interets {editing && `(${interests.length}/5)`}
        </Text>
        <View style={styles.chips}>
          {INTERESTS.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => editing && toggleInterest(interest)}
                disabled={!editing}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {interest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Skills */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Competences</Text>
        {SKILLS_LIST.map((skillName) => {
          const skill = skills.find((s) => s.name === skillName);
          const level = skill?.level || 0;
          return (
            <View key={skillName} style={styles.skillRow}>
              <Text style={styles.skillName}>{skillName}</Text>
              <View style={styles.skillDots}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => editing && updateSkillLevel(skillName, i + 1 === level ? 0 : i + 1)}
                    disabled={!editing}
                  >
                    <View
                      style={[
                        styles.skillDot,
                        i < level && styles.skillDotFilled,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Plan badge */}
      <View style={styles.section}>
        <View style={styles.planBadge}>
          <Ionicons
            name={plan === 'free' ? 'person' : 'diamond'}
            size={18}
            color={plan === 'free' ? 'rgba(255,255,255,0.5)' : Colors.gold}
          />
          <Text style={[styles.planText, plan !== 'free' && { color: Colors.gold }]}>
            {plan === 'free' ? 'Free' : plan === 'business' ? 'Business' : 'Business Pro'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.section, { paddingBottom: 120 }]}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/auth');
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.actionDanger}>Se deconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveText: {
    color: Colors.dark,
    fontSize: 14,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.2,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark400,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark400,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark200,
    borderWidth: 1,
    borderColor: Colors.dark400,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#fff',
    minWidth: 160,
    textAlign: 'right',
  },
  bioInput: {
    minWidth: undefined,
    textAlign: 'left',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bioText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.dark200,
    borderWidth: 1,
    borderColor: Colors.dark400,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: 'rgba(212,168,83,0.15)',
    borderColor: Colors.gold,
  },
  chipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  chipTextSelected: {
    color: Colors.gold,
    fontWeight: '600',
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  skillName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    flex: 1,
  },
  skillDots: {
    flexDirection: 'row',
    gap: 4,
  },
  skillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skillDotFilled: {
    backgroundColor: Colors.gold,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark200,
    borderRadius: 12,
    padding: 14,
  },
  planText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  actionDanger: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '500',
  },
});
