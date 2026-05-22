import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { normalizePlan, DEFAULT_PREFERENCES } from '@/lib/utils';
import { mockProfiles } from '@/lib/mock-data';
import { USE_MOCK_DATA } from '@/lib/config';
import SwipeCard from '@/components/SwipeCard';
import MatchModal from '@/components/MatchModal';
import type { Profile, Preferences, SkillFilter } from '@/lib/types';

const STACK_RENDER_COUNT = 3;
const VIEW_COOLDOWN_DAYS = 14;

function deterministicShuffle(items: Profile[], seed: string): Profile[] {
  const hashed = items.map((p) => {
    let h = 0;
    const key = seed + p.id;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return { profile: p, hash: h };
  });
  hashed.sort((a, b) => a.hash - b.hash);
  return hashed.map((h) => h.profile);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { profile, setProfile } = useAppStore();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [likedMeIds, setLikedMeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [lastSwipedProfile, setLastSwipedProfile] = useState<Profile | null>(null);
  const [lastSwipeDir, setLastSwipeDir] = useState<'left' | 'right' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const todayKey = new Date().toISOString().split('T')[0];
  const plan = normalizePlan(profile?.plan);
  const isPro = plan === 'business_pro';

  const userLat = (profile as any)?.city_lat ?? null;
  const userLng = (profile as any)?.city_lng ?? null;

  const preferences = useMemo<Preferences>(() => {
    if (!profile || !isPro) return DEFAULT_PREFERENCES;
    const rawPrefs = (profile as any).preferences || {};
    return {
      distance_km: Number(rawPrefs.distance_km ?? DEFAULT_PREFERENCES.distance_km),
      age_min: Number(rawPrefs.age_min ?? DEFAULT_PREFERENCES.age_min),
      age_max: Number(rawPrefs.age_max ?? DEFAULT_PREFERENCES.age_max),
      skill_filters: Array.isArray(rawPrefs.skill_filters) ? rawPrefs.skill_filters : [],
    };
  }, [profile, isPro]);

  const skillFilters = useMemo<SkillFilter[]>(
    () => (isPro ? preferences.skill_filters ?? [] : []),
    [isPro, preferences.skill_filters],
  );

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setCurrentUserId('current_user');
    }
  }, []);

  const recordProfileView = (viewedId: string) => {
    // Mode mock : ignorer
  };

  const loadProfiles = useCallback(async () => {
    if (USE_MOCK_DATA) {
      // Mode mock : utiliser directement les profils mockéss
      setProfiles(mockProfiles as Profile[]);
      setLoading(false);
      return;
    }

  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) loadProfiles();
  }, [currentUserId, loadProfiles]);

  const handleSwipe = async (dir: 'left' | 'right', swipedProfile: Profile) => {
    if (!currentUserId || !profile || !swipedProfile?.id) return;

    if (!USE_MOCK_DATA) {
      // Mode Supabase : à implémenter
      return;
    }

    // Mode mock : juste supprimer le profil et afficher le suivant
    setLastSwipedProfile(swipedProfile);
    setLastSwipeDir(dir);
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== swipedProfile.id);
      return next;
      });

      if (dir !== 'right') return;

      await supabase.from('likes').upsert(
        { liker_id: currentUserId, liked_id: swipedProfile.id },
        { onConflict: 'liker_id,liked_id' },
      );

      const { data: mutualLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_id', swipedProfile.id)
        .eq('liked_id', currentUserId)
        .maybeSingle();

      if (mutualLike) {
        const [user1_id, user2_id] = [currentUserId, swipedProfile.id].sort();
        await supabase.from('matches').upsert(
          { user1_id, user2_id },
          { onConflict: 'user1_id,user2_id' },
        );

        const bothCanChat = isPaidPlan(profile.plan) && isPaidPlan(swipedProfile.plan);
        if (bothCanChat) {
          await supabase.rpc('get_or_create_conversation', {
            other_user_id: swipedProfile.id,
          });
        }

        setMatchedProfile(swipedProfile);
        setShowMatch(true);
      }
    } catch {
      Alert.alert('Erreur', 'Erreur lors du swipe');
    }
  };

  const handleUndo = () => {
    if (!isPro) {
      Alert.alert(
        'Business Pro requis',
        'Passe a Business Pro pour annuler ton dernier swipe.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Voir les plans', onPress: () => router.push('/(tabs)/settings') },
        ],
      );
      return;
    }

    if (!currentUserId || !lastSwipedProfile) return;

    setProfiles((prev) => [lastSwipedProfile, ...prev]);
    setLastSwipedProfile(null);
    setLastSwipeDir(null);
  };

  const currentProfile = profiles[0] ?? null;
  const stackForRender = profiles.slice(0, STACK_RENDER_COUNT).slice().reverse();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>PAKT</Text>
        {lastSwipedProfile && (
          <TouchableOpacity style={styles.undoHeader} onPress={handleUndo}>
            <Ionicons name="arrow-undo" size={20} color={Colors.gold} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardArea}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="globe-outline" size={64} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>Aucun profil disponible</Text>
            <Text style={styles.emptySubtitle}>
              Reviens plus tard pour decouvrir de nouvelles personnes.
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadProfiles}>
              <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.refreshText}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stackForRender.map((item, index) => {
            const isTop = item.id === currentProfile?.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.cardWrapper,
                  { zIndex: isTop ? 20 : 10 + index },
                ]}
              >
                <SwipeCard
                  profile={item}
                  onSwipe={(dir) => {
                    if (!isTop) return;
                    handleSwipe(dir, item);
                  }}
                  onUndo={handleUndo}
                  canUndo={!!lastSwipedProfile}
                  hasLikedYou={likedMeIds.has(item.id)}
                  isTop={isTop}
                />
              </View>
            );
          })
        )}
      </View>

      <MatchModal
        visible={showMatch}
        myProfile={profile}
        matchedProfile={matchedProfile}
        onClose={() => setShowMatch(false)}
        onMessage={() => {
          setShowMatch(false);
          router.push('/(tabs)/messages');
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: Colors.gold,
  },
  undoHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 8,
  },
  refreshText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
});
