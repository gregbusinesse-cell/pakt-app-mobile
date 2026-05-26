import { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
  Modal,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import { ProfileImage } from '@/components/ProfileImage'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'
import { useActivityTracker } from '@/lib/hooks/useActivityTracker'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Message = Database['public']['Tables']['messages']['Row']

interface MessageWithStatus extends Message {
  senderProfile?: Profile | null
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export default function ChatDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const conversationId = id as string

  const [messages, setMessages] = useState<MessageWithStatus[]>([])
  const [participant, setParticipant] = useState<Profile | null>(null)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isBlockedByOther, setIsBlockedByOther] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  const { isOnline, statusText } = useOnlineStatus(participant?.id || null)

  // Track activity
  useActivityTracker()

  const canSendMessage = currentUser?.subscription_plan !== 'free' && !isBlocked && !isBlockedByOther

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString()
    setToasts([...toasts, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  useEffect(() => {
    const fetchChatData = async () => {
      try {
        setLoading(true)

        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          router.back()
          return
        }

        // Get conversation details
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (convError) throw convError

        // Get current user profile
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setCurrentUser(userProfile)

        // Get participant
        const participantId =
          conv.user1_id === session.user.id ? conv.user2_id : conv.user1_id

        const { data: participantProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participantId)
          .single()

        setParticipant(participantProfile)

        // Check if blocked
        const { data: blockCheck } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', session.user.id)
          .eq('blocked_id', participantId)
          .single()

        setIsBlocked(!!blockCheck)

        // Check if blocked by other user
        const { data: blockCheckOther } = await supabase
          .from('blocked_users')
          .select('id')
          .eq('blocker_id', participantId)
          .eq('blocked_id', session.user.id)
          .single()

        setIsBlockedByOther(!!blockCheckOther)

        // Fetch messages
        await fetchMessages(conversationId)

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', session.user.id)
      } catch (err) {
        console.error('Error loading chat:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChatData()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages(conversationId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages(conversationId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const fetchMessages = async (convId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Get sender profiles for messages
      const senderIds = [...new Set(messagesData.map((m) => m.sender_id))]
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds)

      const profileMap = new Map(senderProfiles?.map((p) => [p.id, p]) || [])

      const messagesWithProfiles = messagesData.map((msg) => ({
        ...msg,
        senderProfile: profileMap.get(msg.sender_id) || null,
      }))

      setMessages(messagesWithProfiles)

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 100)
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser) return

    // Check current user's plan
    if (currentUser.subscription_plan === 'free') {
      showToast('Les utilisateurs gratuits ne peuvent pas envoyer de messages', 'error')
      Alert.alert(
        'Fonctionnalité Premium',
        'Passez à Business (5€/mois) pour débloquer la messagerie',
        [
          { text: 'Annuler', onPress: () => {} },
          { text: 'Passer à Business', onPress: () => router.push('/settings' as any) }
        ]
      )
      return
    }

    // Check other user's plan
    if (!participant?.subscription_plan || participant.subscription_plan === 'free') {
      showToast('Ce profil n\'a pas le plan Business', 'error')
      Alert.alert(
        'Plan Business Requis',
        'Ce profil doit avoir le plan Business pour échanger des messages.',
        [{ text: 'OK', onPress: () => {} }]
      )
      return
    }

    if (isBlocked) {
      showToast('Vous avez bloqué cet utilisateur', 'error')
      return
    }

    if (isBlockedByOther) {
      showToast('Vous ne pouvez pas envoyer de messages à cet utilisateur', 'error')
      return
    }

    try {
      setSending(true)

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: messageText,
        message_type: 'text',
      })

      if (error) throw error

      setMessageText('')
      showToast('Message envoyé', 'success')
      await fetchMessages(conversationId)
    } catch (err) {
      console.error('Error sending message:', err)
      showToast('Erreur lors de l\'envoi du message', 'error')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}j`

    return date.toLocaleDateString('fr-FR')
  }

  const handleBlockUser = async () => {
    if (!currentUser || !participant) return

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUser.id,
          blocked_id: participant.id,
          reason: 'Bloqué via chat'
        })

      if (error) throw error

      setIsBlocked(true)
      showToast(`${participant.first_name} a été bloqué`, 'success')
      setShowMoreMenu(false)
    } catch (err) {
      console.error('Error blocking user:', err)
      showToast('Erreur lors du blocage', 'error')
    }
  }

  const handleUnblockUser = async () => {
    if (!currentUser || !participant) return

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', participant.id)

      if (error) throw error

      setIsBlocked(false)
      showToast(`${participant.first_name} a été débloqué`, 'success')
    } catch (err) {
      console.error('Error unblocking user:', err)
      showToast('Erreur lors du déblocage', 'error')
    }
  }

  const handleReportUser = async () => {
    Alert.alert(
      'Signaler cet utilisateur',
      'Expliquez pourquoi vous signalez cet utilisateur',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Comportement inapproprié',
          onPress: () => reportUserWithReason('Comportement inapproprié')
        },
        {
          text: 'Contenu offensant',
          onPress: () => reportUserWithReason('Contenu offensant')
        },
        {
          text: 'Escroquerie/Spam',
          onPress: () => reportUserWithReason('Escroquerie/Spam')
        }
      ]
    )
  }

  const reportUserWithReason = async (reason: string) => {
    if (!participant) return

    try {
      // In production, this would send to a reports table or email
      console.log('Report:', {
        userId: participant.id,
        userName: participant.first_name,
        reason,
        timestamp: new Date().toISOString()
      })

      showToast('Merci d\'avoir signalé cet utilisateur', 'success')
    } catch (err) {
      showToast('Erreur lors du signalement', 'error')
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      'Supprimer le message',
      'Cette action est irréversible',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .eq('sender_id', currentUser?.id)

              setMessages(prev => prev.filter(m => m.id !== messageId))
              showToast('Message supprimé', 'success')
            } catch (err) {
              showToast('Erreur lors de la suppression', 'error')
            }
          },
          style: 'destructive'
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ffd700" />
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.profileSection}>
            <ProfileImage
              photos={participant?.photos as any}
              style={styles.avatar}
              placeholder={styles.avatarPlaceholder}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {participant?.first_name}, {participant?.age}
              </Text>
              <View style={styles.statusRow}>
                {isOnline && (
                  <View
                    style={[
                      styles.statusDot,
                      styles.statusDotOnline,
                    ]}
                  />
                )}
                <Text style={[styles.statusText, { color: isOnline ? '#4ade80' : '#ffffff66' }]}>
                  {statusText}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowMoreMenu(!showMoreMenu)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#ffd700" />
        </TouchableOpacity>
      </View>

      {/* More Menu */}
      {showMoreMenu && (
        <View style={styles.moreMenu}>
          {isBlocked ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                handleUnblockUser()
                setShowMoreMenu(false)
              }}
            >
              <Ionicons name="lock-open" size={18} color="#4caf50" />
              <Text style={styles.menuText}>Débloquer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                handleBlockUser()
              }}
            >
              <Ionicons name="lock-closed" size={18} color="#ff9800" />
              <Text style={styles.menuText}>Bloquer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              handleReportUser()
              setShowMoreMenu(false)
            }}
          >
            <Ionicons name="flag" size={18} color="#ff4444" />
            <Text style={styles.menuText}>Signaler</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color="#ffffff44" />
            <Text style={styles.emptyText}>Aucun message pour le moment</Text>
            <Text style={styles.emptySubtext}>Commencez la conversation</Text>
          </View>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === currentUser?.id
            const showAvatar =
              idx === messages.length - 1 ||
              messages[idx + 1]?.sender_id !== msg.sender_id

            return (
              <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                {!isOwn && (
                  <View style={styles.avatarCol}>
                    {showAvatar ? (
                      <ProfileImage
                        photos={msg.senderProfile?.photos as any}
                        style={styles.messagAvatar}
                        placeholder={styles.messagAvatarPlaceholder}
                      />
                    ) : (
                      <View style={styles.messagAvatarSpacer} />
                    )}
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
                  ]}
                >
                  <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                    {msg.content}
                  </Text>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isOwn && (
                      <View style={styles.statusIndicator}>
                        {msg.is_read ? (
                          <>
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#ffd700"
                              style={{ marginRight: 2 }}
                            />
                            <Ionicons name="checkmark" size={12} color="#ffd700" />
                          </>
                        ) : (
                          <Ionicons name="checkmark" size={12} color="#ffffff66" />
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {isOwn && <View style={styles.avatarColOwn} />}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputSection}>
        {!canSendMessage ? (
          <View style={styles.restrictedMessageBox}>
            {currentUser?.subscription_plan === 'free' ? (
              <>
                <Ionicons name="lock-closed" size={20} color="#ff9800" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.restrictedTitle}>Messagerie Premium</Text>
                  <Text style={styles.restrictedText}>
                    Passez à Business pour envoyer des messages
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/settings' as any)}
                  style={styles.upgradeButton}
                >
                  <Text style={styles.upgradeButtonText}>Upgrader</Text>
                </TouchableOpacity>
              </>
            ) : isBlocked ? (
              <>
                <Ionicons name="warning" size={20} color="#ff4444" />
                <Text style={[styles.restrictedText, { marginLeft: 12 }]}>
                  Vous avez bloqué cet utilisateur
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="warning" size={20} color="#ff4444" />
                <Text style={[styles.restrictedText, { marginLeft: 12 }]}>
                  Cet utilisateur vous a bloqué
                </Text>
              </>
            )}
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Écrire un message..."
              placeholderTextColor="#ffffff44"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="send" size={18} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Toasts */}
      <View style={styles.toastContainer}>
        {toasts.map(toast => (
          <View key={toast.id} style={[styles.toast, styles[`toast${toast.type}`]]}>
            <Ionicons
              name={
                toast.type === 'success'
                  ? 'checkmark-circle'
                  : toast.type === 'error'
                  ? 'close-circle'
                  : 'information-circle'
              }
              size={16}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOnline: {
    backgroundColor: '#4caf50',
  },
  statusDotOffline: {
    backgroundColor: '#ffffff44',
  },
  statusText: {
    color: '#ffffff66',
    fontSize: 12,
  },
  moreButton: {
    padding: 8,
  },

  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#ffffff66',
    fontSize: 13,
    marginTop: 4,
  },

  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  avatarCol: {
    width: 28,
  },
  avatarColOwn: {
    width: 28,
  },
  messagAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messagAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
  },
  messagAvatarSpacer: {
    width: 28,
    height: 28,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  messageBubbleOther: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  messageBubbleOwn: {
    backgroundColor: '#ffd700',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  messageTextOwn: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    color: '#ffffff66',
    fontSize: 11,
  },
  messageTimeOwn: {
    color: '#00000066',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ffd70044',
  },

  // More Menu
  moreMenu: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 12,
  },
  menuText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Restricted Message
  restrictedMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ff980044',
    gap: 8,
  },
  restrictedTitle: {
    color: '#ff9800',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  restrictedText: {
    color: '#ffffff88',
    fontSize: 12,
    lineHeight: 16,
  },
  upgradeButton: {
    backgroundColor: '#ffd700',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },

  // Toasts
  toastContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  toastsuccess: {
    backgroundColor: '#4caf5088',
  },
  toasterror: {
    backgroundColor: '#ff444488',
  },
  toastinfo: {
    backgroundColor: '#2196f388',
  },
  toastText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
})
