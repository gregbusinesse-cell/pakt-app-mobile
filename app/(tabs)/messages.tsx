import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { formatTime, normalizePlan, canChat, cleanPhotoUrls } from '@/lib/utils';
import { mockConversations, mockProfiles, mockMessages } from '@/lib/mock-data';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Profile } from '@/lib/types';

interface ConversationItem {
  id: string;
  otherUser: Profile;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isLocked: boolean;
  isOnline: boolean;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { profile, refreshNotifications } = useAppStore();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const myPlan = normalizePlan(profile?.plan);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setCurrentUserId('current_user');
    }
  }, []);

  useEffect(() => {
    if (USE_MOCK_DATA && currentUserId) {
      setTimeout(() => {
        const convItems: ConversationItem[] = mockConversations.map((conv) => {
          const otherId = conv.user_id_1 === currentUserId ? conv.user_id_2 : conv.user_id_1;
          const otherUser = mockProfiles.find((p) => p.id === otherId) || ({} as Profile);
          return {
            id: conv.id,
            otherUser,
            lastMessage: conv.last_message,
            lastMessageAt: conv.last_message_at,
            unreadCount: 0,
            isLocked: false,
            isOnline: Math.random() > 0.5,
          };
        });
        setConversations(convItems);
        setLoading(false);
      }, 300);
    }
  }, [currentUserId]);

  const loadConversations = async () => {
    if (USE_MOCK_DATA) return;

    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      const convRows = convData || [];
      const otherIds = convRows.map((c: any) =>
        c.user1_id === currentUserId ? c.user2_id : c.user1_id,
      );

      let profileMap = new Map<string, Profile>();
      if (otherIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', [...new Set(otherIds)]);
        if (profilesData) {
          profileMap = new Map(profilesData.map((p: any) => [p.id, p as Profile]));
        }
      }

      const items: ConversationItem[] = await Promise.all(
        convRows.map(async (conv: any) => {
          const otherId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
          const otherUser = profileMap.get(otherId) || ({
            id: otherId,
            first_name: null,
            photos: [],
            plan: 'free',
          } as any);

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, message_type, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', currentUserId)
            .eq('is_read', false);

          let lastMessageText: string | null = null;
          if (lastMsg) {
            const isMine = lastMsg.sender_id === currentUserId;
            const prefix = isMine ? 'Vous' : (otherUser.first_name || 'Profil');
            if (lastMsg.message_type === 'audio') lastMessageText = `${prefix} a envoye un vocal`;
            else if (lastMsg.message_type === 'image') lastMessageText = `${prefix} a envoye une photo`;
            else if (lastMsg.message_type === 'file') lastMessageText = `${prefix} a envoye un document`;
            else lastMessageText = lastMsg.content;
          }

          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const isOnline = otherUser.updated_at ? otherUser.updated_at > fiveMinAgo : false;

          return {
            id: conv.id,
            otherUser,
            lastMessage: lastMessageText,
            lastMessageAt: lastMsg?.created_at || conv.created_at,
            unreadCount: unreadCount || 0,
            isLocked: !canChat(profile?.plan, otherUser.plan),
            isOnline,
          };
        }),
      );

      items.sort((a, b) => {
        const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bT - aT;
      });

      setConversations(items);
    } catch {
      Alert.alert('Erreur', 'Erreur chargement conversations');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, profile?.plan]);

  useEffect(() => {
    if (currentUserId) loadConversations();
  }, [currentUserId, loadConversations]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`messages-rt-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () =>
        loadConversations(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () =>
        loadConversations(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadConversations]);

  const openChat = async (conv: ConversationItem) => {
    if (!currentUserId) return;

    if (conv.unreadCount > 0) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', currentUserId)
        .eq('is_read', false);
      refreshNotifications();
    }

    router.push(`/chat/${conv.id}?userId=${conv.otherUser.id}`);
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const name = (c.otherUser.first_name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const renderItem = ({ item }: { item: ConversationItem }) => {
    const photos = cleanPhotoUrls(item.otherUser.photos);
    const isFree = !isPaidPlan(myPlan);

    return (
      <TouchableOpacity
        style={styles.convRow}
        activeOpacity={0.7}
        onPress={() => openChat(item)}
      >
        {/* Avatar with online dot */}
        <View style={styles.avatarContainer}>
          {photos[0] ? (
            <Image
              source={{ uri: photos[0] }}
              style={[
                styles.avatar,
                item.isLocked && isFree && { opacity: 0.3 },
              ]}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>

        {/* Info */}
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text style={styles.convName} numberOfLines={1}>
              {item.isLocked && isFree
                ? 'Conversation verrouillee'
                : item.otherUser.first_name || 'Profil'}
            </Text>
            {item.lastMessageAt && (
              <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
            )}
          </View>
          <View style={styles.convBottom}>
            <Text style={styles.convMessage} numberOfLines={1}>
              {item.isLocked
                ? isPaidPlan(myPlan)
                  ? 'Ce membre doit passer Business'
                  : 'Passe Business pour discuter'
                : item.lastMessage || 'Nouvelle conversation'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.3)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={56} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyTitle}>
            {search.trim() ? 'Aucun resultat' : 'Aucune conversation'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search.trim()
              ? 'Essaie un autre nom'
              : 'Tes conversations apparaitront ici apres un match.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark200,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
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
  list: {
    paddingBottom: 100,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark300,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: Colors.dark,
  },
  convInfo: {
    flex: 1,
    gap: 4,
  },
  convTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  convTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginLeft: 8,
  },
  convBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convMessage: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: {
    color: Colors.dark,
    fontSize: 11,
    fontWeight: '700',
  },
});
