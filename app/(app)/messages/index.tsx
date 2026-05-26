import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { useConversations } from '@/lib/hooks/useConversations'
import { ProfileImage } from '@/components/ProfileImage'
import { Ionicons } from '@expo/vector-icons'

export default function MessagesPage() {
  const router = useRouter()
  const { conversations, loading, error } = useConversations()
  const [searchQuery, setSearchQuery] = useState('')

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) => {
    const name = conv.participant?.first_name || 'Utilisateur'
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={{ color: '#fff', marginTop: 16 }}>Chargement...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#ffffff66" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          placeholderTextColor="#ffffff44"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#ffffff66" />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversations List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Erreur: {error}</Text>
          </View>
        ) : conversations.length === 0 ? (
          // No conversations yet
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color="#ffffff44" />
            <Text style={styles.emptyTitle}>Vos conversations arrivent bientôt !</Text>
            <Text style={styles.emptyText}>
              Dès que vous aurez un match avec quelqu'un, vos conversations apparaîtront ici
            </Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          // Search has no results
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#ffffff44" />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>
              "{searchQuery}" ne correspond à aucune conversation
            </Text>
          </View>
        ) : (
          // Show filtered conversations
          <View>
            {filteredConversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.conversationCard}
                onPress={() => router.push(`/messages/${conv.id}` as any)}
                onLongPress={() => {
                  // Long press to show options (can implement swipe actions here)
                }}
              >
                <View style={styles.avatarContainer}>
                  <ProfileImage
                    photos={conv.participant?.photos as any}
                    style={styles.avatar}
                    placeholder={styles.avatarPlaceholder}
                  />
                </View>

                <View style={styles.conversationInfo}>
                  <View style={styles.headerRow}>
                    <Text style={styles.conversationName} numberOfLines={1}>
                      {conv.participant?.first_name || 'Utilisateur'}, {conv.participant?.age}
                    </Text>
                    <Text style={styles.messageTime}>
                      {conv.updated_at
                        ? new Date(conv.updated_at).toLocaleDateString('fr-FR', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </Text>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conv.last_message || 'Aucun message'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.moreButtonMessages}>
                  <Ionicons name="chevron-forward" size={20} color="#ffffff44" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },

  /* Search Bar */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
    color: '#fff',
    fontSize: 14,
  },
  clearButton: {
    padding: 6,
  },

  /* Content */
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1 },

  /* Conversation Card */
  conversationCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
  conversationInfo: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  messageTime: { color: '#ffffff66', fontSize: 12, marginLeft: 8 },
  lastMessage: { color: '#ffffff66', fontSize: 13 },

  /* Empty State */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptyText: { color: '#ffffff66', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 18 },

  /* More Button */
  moreButtonMessages: {
    padding: 8,
  },
})
