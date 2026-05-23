import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { formatTime, normalizePlan, isPaidPlan, cleanPhotoUrls } from '@/lib/utils';
import { mockMatches, mockLikes, mockProfiles } from '@/lib/mock-data';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Profile } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

interface MatchItem {
  id: string;
  otherUser: Profile;
  conversationId: string | null;
  createdAt: string | null;
  isViewed: boolean;
}

interface LikeItem {
  likeId: string;
  otherUser: Profile;
  createdAt: string | null;
  isViewed: boolean;
}

type Tab = 'matches' | 'likes';

function getPairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

export default function MatchesScreen() {
  const router = useRouter();
  const { profile, refreshNotifications } = useAppStore();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('matches');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const plan = normalizePlan(profile?.plan);
  const isBusinessPro = plan === 'business_pro';

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setCurrentUserId('current_user');
    }
  }, []);

  useEffect(() => {
    if (USE_MOCK_DATA && currentUserId) {
      setTimeout(() => {
        // Charger les mock matches
        const mockMatchItems: MatchItem[] = mockMatches.map((m) => ({
          id: m.id,
          otherUser: mockProfiles.find((p) => p.id === m.user2_id) || ({} as Profile),
          conversationId: 'conv' + m.id,
          createdAt: m.created_at,
          isViewed: m.is_viewed,
        }));
        setMatches(mockMatchItems);

        // Charger les mock likes
        const mockLikeItems: LikeItem[] = mockLikes.map((l) => ({
          likeId: l.id,
          otherUser: mockProfiles.find((p) => p.id === l.liker_id) || ({} as Profile),
          createdAt: l.created_at,
          isViewed: l.is_viewed,
        }));
        setLikes(mockLikeItems);
        setLoading(false);
      }, 300);
    }
  }, [currentUserId]);

  const loadData = useCallback(async () => {
    if (USE_MOCK_DATA) return;

    try {
      const [
        { data: matchesData },
        { data: likesData },
        { data: conversationsData },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('likes')
          .select('id, liker_id, created_at, is_viewed')
          .eq('liked_id', currentUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversations')
          .select('id, user1_id, user2_id')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`),
      ]);

      const matchRows = matchesData || [];
      const likeRows = likesData || [];
      const convRows = conversationsData || [];

      const matchOtherIds = matchRows.map((m: any) =>
        m.user1_id === currentUserId ? m.user2_id : m.user1_id,
      );
      const likeOtherIds = likeRows.map((l: any) => l.liker_id);
      const allIds = [...new Set([...matchOtherIds, ...likeOtherIds])];

      let profileMap = new Map<string, Profile>();
      if (allIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', allIds);
        if (profilesData) {
          profileMap = new Map(profilesData.map((p: any) => [p.id, p as Profile]));
        }
      }

      const convByPair = new Map<string, string>();
      convRows.forEach((c: any) => {
        convByPair.set(getPairKey(c.user1_id, c.user2_id), c.id);
      });

      const matchedPairKeys = new Set<string>();
      const matchItems: MatchItem[] = matchRows.map((m: any) => {
        const otherId = m.user1_id === currentUserId ? m.user2_id : m.user1_id;
        const pairKey = getPairKey(currentUserId, otherId);
        matchedPairKeys.add(pairKey);
        return {
          id: m.id,
          otherUser: profileMap.get(otherId) || ({ id: otherId, first_name: null, photos: [] } as any),
          conversationId: convByPair.get(pairKey) || null,
          createdAt: m.created_at,
          isViewed: Boolean(m.is_viewed),
        };
      });

      const likeItems: LikeItem[] = likeRows
        .filter((l: any) => !matchedPairKeys.has(getPairKey(currentUserId, l.liker_id)))
        .map((l: any) => ({
          likeId: l.id,
          otherUser: profileMap.get(l.liker_id) || ({ id: l.liker_id, first_name: null, photos: [] } as any),
          createdAt: l.created_at,
          isViewed: Boolean(l.is_viewed),
        }));

      setMatches(matchItems);
      setLikes(likeItems);
    } catch {
      Alert.alert('Erreur', 'Erreur chargement matchs');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) loadData();
  }, [currentUserId, loadData]);

  useEffect(() => {
    // Realtime subscriptions disabled in mock mode
    if (USE_MOCK_DATA || !currentUserId) return;
    // TODO: Implement Supabase realtime subscriptions in production mode
  }, [currentUserId]);

  const markMatchViewed = useCallback(
    (matchId: string) => {
      if (USE_MOCK_DATA) {
        // Mock mode: just update local state
        setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, isViewed: true } : m)));
        refreshNotifications();
        return;
      }
      // Production mode: would call Supabase
      // TODO: Implement Supabase update call
    },
    [refreshNotifications],
  );

  const openConversation = (match: MatchItem) => {
    if (!currentUserId) return;
    markMatchViewed(match.id);

    if (match.conversationId) {
      router.push(`/chat/${match.conversationId}?userId=${match.otherUser.id}`);
      return;
    }

    if (USE_MOCK_DATA) {
      // Mock mode: generate conversation ID
      router.push(`/chat/conv_${match.otherUser.id}?userId=${match.otherUser.id}`);
      return;
    }

    // Production mode: would call Supabase RPC
    // TODO: Implement Supabase get_or_create_conversation
  };

  const handleAcceptLike = (item: LikeItem) => {
    if (!currentUserId) return;

    if (USE_MOCK_DATA) {
      // Mock mode: just remove from likes and add to matches
      setLikes((prev) => prev.filter((l) => l.likeId !== item.likeId));
      // Simulate adding to matches
      const newMatch: MatchItem = {
        id: `match_${item.otherUser.id}`,
        otherUser: item.otherUser,
        conversationId: `conv_${item.otherUser.id}`,
        createdAt: new Date().toISOString(),
        isViewed: false,
      };
      setMatches((prev) => [...prev, newMatch]);
      refreshNotifications();
      return;
    }

    // Production mode: would call Supabase
    // TODO: Implement Supabase like/match creation
    Alert.alert('Mode développement', 'À implémenter en production');
  };

  const handleRejectLike = (item: LikeItem) => {
    if (!currentUserId) return;

    if (USE_MOCK_DATA) {
      // Mock mode: just remove from likes
      setLikes((prev) => prev.filter((l) => l.likeId !== item.likeId));
      refreshNotifications();
      return;
    }

    // Production mode: would call Supabase
    // TODO: Implement Supabase dislike recording
  };

  const unviewedCount = matches.filter((m) => !m.isViewed).length;

  const renderMatchCard = ({ item }: { item: MatchItem }) => {
    const photos = cleanPhotoUrls(item.otherUser.photos);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.8}
        onPress={() => openConversation(item)}
      >
        {photos[0] ? (
          <Image source={{ uri: photos[0] }} style={styles.gridPhoto} />
        ) : (
          <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
            <Ionicons name="person" size={40} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        {!item.isViewed && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Nouveau</Text>
          </View>
        )}
        <View style={styles.gridInfo}>
          <Text style={styles.gridName} numberOfLines={1}>
            {item.otherUser.first_name || 'Profil'}
            {item.otherUser.age ? `, ${item.otherUser.age}` : ''}
          </Text>
          {item.createdAt && (
            <Text style={styles.gridTime}>{formatTime(item.createdAt)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderLikeCard = ({ item }: { item: LikeItem }) => {
    const photos = cleanPhotoUrls(item.otherUser.photos);
    const isBlurred = !isBusinessPro;
    return (
      <View style={styles.gridCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (!isBusinessPro) {
              Alert.alert(
                'Business Pro requis',
                'Passe a Business Pro pour voir qui t\'a like.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Voir les plans', onPress: () => router.push('/(tabs)/settings') },
                ],
              );
              return;
            }
          }}
        >
          {photos[0] ? (
            <Image
              source={{ uri: photos[0] }}
              style={styles.gridPhoto}
              blurRadius={isBlurred ? 20 : 0}
            />
          ) : (
            <View style={[styles.gridPhoto, styles.gridPhotoPlaceholder]}>
              <Ionicons name="person" size={40} color="rgba(255,255,255,0.2)" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.gridInfo}>
          <Text style={styles.gridName} numberOfLines={1}>
            {isBlurred ? '???' : (item.otherUser.first_name || 'Profil')}
          </Text>
        </View>
        {isBusinessPro && (
          <View style={styles.likeActions}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleRejectLike(item)}
            >
              <Ionicons name="close" size={18} color="#ff4458" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAcceptLike(item)}
            >
              <Ionicons name="heart" size={18} color={Colors.dark} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Matchs</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'matches' && styles.tabActive]}
            onPress={() => setTab('matches')}
          >
            <Ionicons
              name="people"
              size={15}
              color={tab === 'matches' ? Colors.dark : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.tabText, tab === 'matches' && styles.tabTextActive]}>
              Matchs
            </Text>
            {unviewedCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unviewedCount > 9 ? '9+' : unviewedCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'likes' && styles.tabActive]}
            onPress={() => setTab('likes')}
          >
            <Ionicons
              name="star"
              size={15}
              color={tab === 'likes' ? Colors.dark : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.tabText, tab === 'likes' && styles.tabTextActive]}>
              Likes
            </Text>
            {likes.length > 0 && (
              <View style={[styles.badge, { backgroundColor: 'rgba(212,168,83,0.15)' }]}>
                <Text style={[styles.badgeText, { color: Colors.gold }]}>{likes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : tab === 'matches' ? (
        matches.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="flash-outline" size={56} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>Pas encore de matchs</Text>
            <Text style={styles.emptySubtitle}>
              Continue a swiper pour trouver tes matchs !
            </Text>
          </View>
        ) : (
          <FlatList
            data={matches}
            renderItem={renderMatchCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        likes.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="heart-outline" size={56} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>Aucun like</Text>
            <Text style={styles.emptySubtitle}>
              Les personnes qui te likent apparaitront ici.
            </Text>
          </View>
        ) : !isBusinessPro ? (
          <View style={styles.proPrompt}>
            <View style={styles.proIcon}>
              <Ionicons name="heart" size={24} color={Colors.gold} />
            </View>
            <Text style={styles.proCount}>{likes.length}</Text>
            <Text style={styles.proLabel}>
              {likes.length > 1 ? "personnes t'ont like" : "personne t'a like"}
            </Text>
            <TouchableOpacity
              style={styles.proButton}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <Text style={styles.proButtonText}>Passer Business Pro</Text>
            </TouchableOpacity>
            <FlatList
              data={likes}
              renderItem={renderLikeCard}
              keyExtractor={(item) => item.likeId}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={{ paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <FlatList
            data={likes}
            renderItem={renderLikeCard}
            keyExtractor={(item) => item.likeId}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  headerSection: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.dark200,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: Colors.gold,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  tabTextActive: {
    color: Colors.dark,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 100,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.dark200,
  },
  gridPhoto: {
    width: '100%',
    height: CARD_WIDTH * 1.3,
    resizeMode: 'cover',
  },
  gridPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark300,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  newBadgeText: {
    color: Colors.dark,
    fontSize: 11,
    fontWeight: '700',
  },
  gridInfo: {
    padding: 10,
  },
  gridName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gridTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  likeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,68,88,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,88,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proPrompt: {
    alignItems: 'center',
    paddingTop: 24,
    flex: 1,
  },
  proIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  proCount: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.gold,
  },
  proLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 16,
  },
  proButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 8,
  },
  proButtonText: {
    color: Colors.dark,
    fontSize: 14,
    fontWeight: '700',
  },
});
