import { useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useConversations } from '@/lib/hooks/useConversations'
import { ProfileImage } from '@/components/ProfileImage'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'

export default function MessagesPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { conversations, loading, error } = useConversations()
  const [searchQuery, setSearchQuery] = useState('')
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Animate on load
  useState(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitions.normal,
        useNativeDriver: true,
      }).start()
    }
  }, [loading])

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) => {
    const name = conv.participant?.first_name || 'Utilisateur'
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const formatMessageTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 1) return 'À l\'instant'
    if (hours < 24) return `${Math.floor(hours)}h`
    if (diff < 7 * 24 * 60 * 60 * 1000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Tes conversations</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des messages...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>Tes conversations</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.text.tertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une conversation..."
          placeholderTextColor={colors.text.disabled}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversations List */}
      <Animated.ScrollView
        style={[styles.content, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle" size={56} color={colors.error} />
            <Text style={styles.emptyTitle}>Erreur</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>Pas de messages pour l'instant</Text>
            <Text style={styles.emptyText}>
              Dès que tu auras un match, tu pourras commencer à discuter avec ton talent
            </Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={56} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>
              "{searchQuery}" ne correspond à aucune conversation
            </Text>
          </View>
        ) : (
          <View>
            {filteredConversations.map((conv, idx) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.conversationCard}
                onPress={() => router.push(`/messages/${conv.id}` as any)}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <ProfileImage
                    photos={conv.participant?.photos as any}
                    style={styles.avatar}
                    placeholder={styles.avatarPlaceholder}
                  />
                  {/* Online Indicator - if needed */}
                  {(conv as any).isOnline && <View style={styles.onlineIndicator} />}
                </View>

                {/* Content */}
                <View style={styles.conversationInfo}>
                  <View style={styles.headerRow}>
                    <View style={styles.nameSection}>
                      <Text style={styles.conversationName} numberOfLines={1}>
                        {conv.participant?.first_name || 'Utilisateur'}
                      </Text>
                      {conv.participant?.age && (
                        <Text style={styles.age}>, {conv.participant.age}</Text>
                      )}
                    </View>
                    <Text style={styles.messageTime}>
                      {conv.updated_at ? formatMessageTime(conv.updated_at) : '-'}
                    </Text>
                  </View>
                  <Text style={[styles.lastMessage, (conv as any).unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                    {conv.last_message?.replace('[ENC]', '') || 'Aucun message'}
                  </Text>
                </View>

                {/* Unread Badge or Chevron */}
                <View style={styles.rightSection}>
                  {(conv as any).unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {(conv as any).unreadCount > 9 ? '9+' : (conv as any).unreadCount}
                      </Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: spacing.sm,
  },

  // Content
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },

  // Conversation Card
  conversationCard: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.tertiary,
    alignItems: 'center',
    gap: spacing.md,
  },

  avatarContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.bg.quaternary,
    ...shadows.sm,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.quaternary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg.primary,
  },

  // Conversation Info
  conversationInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nameSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  age: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  messageTime: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: spacing.md,
  },
  lastMessage: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400',
  },
  lastMessageUnread: {
    color: colors.text.primary,
    fontWeight: '600',
  },

  // Right Section
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
  },

  // Unread Badge
  unreadBadge: {
    backgroundColor: colors.errorDark,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    ...shadows.glow,
  },
  unreadBadgeText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.lg,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
})
