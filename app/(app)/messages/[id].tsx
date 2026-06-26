import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import { useTheme } from '@/lib/ThemeContext'
import { getColors } from '@/lib/themeColors'

import { useEffect, useState, useRef } from 'react'
import {
  View,
  KeyboardAvoidingView,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  PanResponder,
  GestureResponderEvent,
  Image,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { readAsStringAsync } from 'expo-file-system/legacy'
import { Audio } from 'expo-av'
import { supabase } from '@/lib/supabase/client'

// Audio recording is only available on native platforms, not on web
const IS_WEB = Platform.OS === 'web'
import { ProfileImage } from '@/components/ProfileImage'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'
import { useActivityTracker } from '@/lib/hooks/useActivityTracker'
import { refreshNotificationCount } from '@/lib/hooks/useNotificationCount'
import { reloadConversationsList } from '@/lib/hooks/useConversations'
import { formatExactTime } from '@/lib/utils'
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
  const { theme } = useTheme()
  const colors = getColors(theme)
  const styles = getStyles(colors)
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const conversationId = id as string

  const [messages, setMessages] = useState<MessageWithStatus[]>([])
  const [participant, setParticipant] = useState<Profile | null>(null)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isBlockedByOther, setIsBlockedByOther] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  // Encouragement modal states
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [sendingEncouragement, setSendingEncouragement] = useState(false)

  // Image selection state
  const [selectedImage, setSelectedImage] = useState<{ uri: string; name: string } | null>(null)
  const [showMediaMenu, setShowMediaMenu] = useState(false)

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordedAudio, setRecordedAudio] = useState<{ uri: string; duration: number } | null>(null)

  const scrollViewRef = useRef<ScrollView>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [playbackPosition, setPlaybackPosition] = useState(0) // seconds played

  const { isOnline, statusText } = useOnlineStatus(participant?.id || null)

  // Track activity
  useActivityTracker()

  // Permission states - 3 cases:
  // 1. currentUser is free → cannot send anything (must upgrade)
  // 2. currentUser is business+ AND participant is free → can only send encouragement
  // 3. both are business+ → can send normal messages
  const getUserPlan = (profile: Profile | null) => {
    if (!profile) return 'free'
    // Use the BEST plan between subscription_plan and plan
    // (avoids 'free' from subscription_plan blocking 'business' in plan)
    const RANK: Record<string, number> = { free: 0, business: 1, business_pro: 2, pro: 2 }
    const sp = ((profile.subscription_plan || '') as string).toLowerCase()
    const p  = ((profile.plan || '') as string).toLowerCase()
    const spRank = RANK[sp] ?? 0
    const pRank  = RANK[p]  ?? 0
    return spRank >= pRank ? (sp || 'free') : (p || 'free')
  }

  const isCurrentUserFree = getUserPlan(currentUser) === 'free'
  const isParticipantFree = getUserPlan(participant) === 'free'
  const canSendNormalMessage = !isCurrentUserFree && !isParticipantFree && !isBlocked && !isBlockedByOther
  const canSendEncouragement = !isCurrentUserFree && isParticipantFree && !isBlocked && !isBlockedByOther
  const canSendMessage = canSendNormalMessage

  // Debug permission states
  useEffect(() => {
    console.log('Permission states:', {
      currentUserPlan: getUserPlan(currentUser),
      participantPlan: getUserPlan(participant),
      isCurrentUserFree,
      isParticipantFree,
      canSendNormalMessage,
      canSendEncouragement,
      isBlocked,
      isBlockedByOther,
    })
  }, [currentUser, participant, isBlocked, isBlockedByOther])

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

        // Debug: Log profile data to see subscription_plan field
        console.log('Current user profile:', {
          id: userProfile?.id,
          email: userProfile?.email,
          subscription_plan: userProfile?.subscription_plan,
          plan: (userProfile as any)?.plan,
        })

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
        const { error: readError } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', session.user.id)

        if (readError) {
          console.error('[CHAT] Error marking messages as read:', readError)
        } else {
          console.log('[CHAT] Messages marked as read for conversation:', conversationId)

          // Verify messages are marked as read, then reload
          const verifyAndReload = async () => {
            try {
              // Wait for Supabase to replicate
              await new Promise(resolve => setTimeout(resolve, 1000))

              // Verify that messages are actually marked as read
              const { count: unreadCount } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)
                .neq('sender_id', session.user.id)
                .eq('is_read', false)

              console.log('[CHAT] Unread messages after mark-as-read:', unreadCount)

              if (unreadCount === 0) {
                console.log('[CHAT] All messages are read. Refreshing notification count and conversations list')
                refreshNotificationCount(session.user.id)
                reloadConversationsList()
              } else {
                console.warn('[CHAT] Some messages are still unread, retrying...')
                // Retry after another delay
                setTimeout(verifyAndReload, 500)
              }
            } catch (err) {
              console.error('[CHAT] Error verifying messages:', err)
            }
          }

          verifyAndReload()
        }
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

  // Refetch profiles when app returns to foreground (in case plan changed in settings)
  const refetchProfiles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id || !conversationId) return

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (userProfile) setCurrentUser(userProfile)

      // Get conversation to find participant
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (conv) {
        const participantId = conv.user1_id === session.user.id ? conv.user2_id : conv.user1_id
        const { data: participantProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participantId)
          .single()

        if (participantProfile) setParticipant(participantProfile)
      }
    } catch (err) {
      console.error('[CHAT] Error refetching profiles:', err)
    }
  }

  // Refetch profiles when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refetchProfiles()
      }
    })
    return () => subscription.remove()
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

    // Check permissions
    if (isCurrentUserFree) {
      showToast('Les utilisateurs gratuits ne peuvent pas envoyer de messages', 'error')
      Alert.alert(
        'Fonctionnalité Premium',
        'Passez à Business (5€/mois) pour débloquer la messagerie',
        [
          { text: 'Annuler', onPress: () => {} },
          { text: 'Passer à Business', onPress: () => router.push('/settings?scroll=pro' as any) }
        ]
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
      await fetchMessages(conversationId)

      // Push notification to the other participant
      if (participant?.id) {
        const SUPA = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
        const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
        fetch(`${SUPA}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': ANON },
          body: JSON.stringify({
            to_user_id: participant.id,
            title: `💬 ${currentUser?.first_name || 'Message'}`,
            body: messageText.length > 60 ? messageText.substring(0, 60) + '...' : messageText,
            data: { type: 'message', conversation_id: conversationId },
          }),
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Error sending message:', err)
      showToast('Erreur lors de l\'envoi du message', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleSendEncouragement = async () => {
    if (!currentUser || !participant) return
    if (!canSendEncouragement) return

    setSendingEncouragement(true)

    try {
      // Check if user has sent an encouragement in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recentEncouragement, error: checkError } = await supabase
        .from('encouragements')
        .select('id')
        .eq('sender_id', currentUser.id)
        .eq('target_id', participant.id)
        .gte('created_at', oneDayAgo)
        .maybeSingle()

      if (checkError) throw checkError

      if (recentEncouragement) {
        showToast('Vous avez déjà envoyé un encouragement à cette personne aujourd\'hui', 'error')
        setShowEncouragementModal(false)
        setSendingEncouragement(false)
        return
      }

      // Send automatic encouragement message with [ENC] prefix to identify it
      // This is a pre-defined message, not personalized to avoid security issues
      const encouragementMessage = `Rejoins Business pour qu'on puisse discuter ensemble !`

      // 1. Insert into encouragements table
      const { error: encError } = await supabase
        .from('encouragements')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          target_id: participant.id,
          message: encouragementMessage,
        })

      if (encError) {
        console.error('Encouragement insert error:', encError)
        throw encError
      }

      // 2. Insert message into messages table
      const messageContent = `[ENC]${encouragementMessage}`
      console.log('Inserting encouragement message:', {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: messageContent,
      })

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: messageContent,
        message_type: 'text',
      })

      if (msgError) {
        console.error('Message insert error:', msgError)
        throw msgError
      }
      console.log('Message inserted successfully')

      showToast('Encouragement envoyé !', 'success')
      setShowEncouragementModal(false)
      await fetchMessages(conversationId)
    } catch (err) {
      console.error('Error sending encouragement:', err)
      showToast('Erreur lors de l\'envoi de l\'encouragement', 'error')
      setShowEncouragementModal(false)
    } finally {
      setSendingEncouragement(false)
    }
  }

  const openEncouragementModal = () => {
    setShowEncouragementModal(true)
  }

  const closeEncouragementModal = () => {
    setShowEncouragementModal(false)
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

  // ── Audio Playback ──────────────────────────────────────────────────────────
  const playAudio = async (url: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync()
        await soundRef.current.unloadAsync()
        soundRef.current = null
        if (playingUrl === url) { setPlayingUrl(null); setPlaybackPosition(0); return }
      }
      setPlayingUrl(url)
      setPlaybackPosition(0)
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false })
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status: any) => {
          if (status.isLoaded) {
            setPlaybackPosition(Math.floor((status.positionMillis || 0) / 1000))
            if (status.didJustFinish) {
              setPlayingUrl(null)
              setPlaybackPosition(0)
              soundRef.current = null
            }
          }
        }
      )
      soundRef.current = sound
    } catch (err) {
      showToast('Impossible de lire le message vocal', 'error')
      setPlayingUrl(null)
    }
  }

  const handleBlockUser = async () => {
    if (!currentUser || !participant) return

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUser.id,
          blocked_id: participant.id,
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
    if (!participant || !currentUser) return

    try {
      // 1. Save report to DB first (always reliable)
      await supabase.from('reports' as any).insert({
        reporter_id: currentUser.id,
        reported_id: participant.id,
        reason,
        conversation_id: conversationId,
        created_at: new Date().toISOString(),
      }).then(() => {}) // ignore if table doesn't exist yet

      // 2. Send email notification via Edge Function (with auth header)
      const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
      const { data: { session: reportSession } } = await supabase.auth.getSession()
      fetch(`${SUPA_URL}/functions/v1/report-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${reportSession?.access_token || ANON_KEY}`,
        },
        body: JSON.stringify({
          reported_id: participant.id,
          reported_name: participant.first_name,
          reporter_id: currentUser.id,
          reporter_name: currentUser.first_name,
          reason,
          conversation_id: conversationId,
        }),
      }).then(r => r.json()).then(d => console.log('[REPORT] Email result:', d)).catch(e => console.error('[REPORT] Error:', e))

      showToast('Signalement envoyé. Merci.', 'success')
    } catch (err) {
      showToast('Signalement enregistré. Merci.', 'success')
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

  // ─── Image Selection Functions ───
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedImage({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
        })
        setShowMediaMenu(false)
      }
    } catch (err) {
      console.error('Error picking image:', err)
      showToast('Erreur lors de la sélection de l\'image', 'error')
    }
  }

  const sendSelectedImage = async () => {
    if (!selectedImage || !conversationId || !currentUser?.id) return

    try {
      setSending(true)

      // Use expo-file-system to handle Android content:// URIs
      const base64 = await readAsStringAsync(selectedImage.uri, {
        encoding: 'base64' as any,
      })
      const binaryString = atob(base64)
      const byteArray = new Uint8Array(binaryString.length)
      for (let j = 0; j < binaryString.length; j++) byteArray[j] = binaryString.charCodeAt(j)

      const fileName = `img_${Date.now()}_${selectedImage.name}`
      const ext = selectedImage.name.split('.').pop()?.toLowerCase() || 'jpg'
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

      const { error: uploadError } = await supabase.storage
        .from('message_attachments')
        .upload(`images/${conversationId}/${fileName}`, byteArray, { contentType, upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('message_attachments')
        .getPublicUrl(`images/${conversationId}/${fileName}`)

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: '[IMAGE]',
        message_type: 'image',
        file_url: urlData.publicUrl,
        file_name: selectedImage.name,
      })

      setSelectedImage(null)
      await fetchMessages(conversationId)
      // Push notification for image
      if (participant?.id) {
        const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
        fetch(`${SUPA_URL}/functions/v1/send-push-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
          body: JSON.stringify({ to_user_id: participant.id, title: `📷 ${currentUser?.first_name || 'Message'}`, body: 'Vous avez reçu un message', data: { type: 'message', conversation_id: conversationId } }),
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Error sending image:', err)
      showToast('Erreur lors de l\'envoi de l\'image', 'error')
    } finally {
      setSending(false)
    }
  }

  // ─── Audio Recording Functions ───
  const startRecording = async () => {
    try {
      // Force-unload any existing recording first (fixes "Only one Recording" error)
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync() } catch {}
        recordingRef.current = null
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      if (isRecording) {
        setIsRecording(false)
        return
      }

      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) {
        showToast('Permission micro refusée', 'error')
        return
      }

      setRecordingDuration(0)
      setIsRecording(true)

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        active: true,
      })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()

      recordingRef.current = recording
      console.log('[REC] Recording started successfully')

      // Start timer now that recording is actually running
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('[REC] Error starting recording:', err)
      showToast('Erreur micro: ' + (err instanceof Error ? err.message : 'Inconnu'), 'error')
      setIsRecording(false)
      setRecordingDuration(0)
      // Clean up any partial recording
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync()
        } catch (e) {
          // Ignore cleanup errors
        }
        recordingRef.current = null
      }
    }
  }

  const stopRecording = async () => {
    try {
      console.log('[REC] Stopping recording...')

      // Clear timer first
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      if (!recordingRef.current) {
        console.log('[REC] No active recording to stop')
        setIsRecording(false)
        return
      }

      const recordingToStop = recordingRef.current
      recordingRef.current = null
      setIsRecording(false)

      const status = await recordingToStop.stopAndUnloadAsync()
      const uri = recordingToStop.getURI() || ''
      const durationMs = status.durationMillis || 0
      const duration = Math.floor(durationMs / 1000)

      console.log('[REC] Recording stopped - durationMillis:', durationMs, 'duration:', duration, 'uri:', uri, 'status:', status)

      // If status duration is 0 but we recorded, use recordingDuration from timer
      const finalDuration = duration > 0 ? duration : recordingDuration
      console.log('[REC] Final duration to use:', finalDuration)

      if (uri && finalDuration >= 1) {
        setRecordedAudio({ uri, duration: finalDuration })
      } else if (!uri) {
        showToast('Erreur: Impossible de sauvegarder l\'enregistrement', 'error')
        setRecordingDuration(0)
      } else {
        showToast('Le vocal doit faire minimum une seconde', 'error')
        setRecordingDuration(0)
      }
    } catch (err) {
      console.error('[REC] Error stopping recording:', err)
      showToast('Erreur arrêt: ' + (err instanceof Error ? err.message : 'Inconnu'), 'error')
      setIsRecording(false)
      setRecordingDuration(0)
      recordingRef.current = null
    }
  }

  const sendRecordedAudio = async () => {
    if (!recordedAudio || !conversationId || !currentUser?.id) {
      console.log('[AUDIO] Missing data:', { recordedAudio, conversationId, userId: currentUser?.id })
      return
    }

    try {
      setSending(true)
      console.log('[AUDIO] Starting send, duration:', recordedAudio.duration)

      // Use legacy readAsStringAsync for audio
      const base64 = await readAsStringAsync(recordedAudio.uri, {
        encoding: 'base64' as any,
      })
      console.log('[AUDIO] Base64 encoded, size:', base64.length)

      const binaryString = atob(base64)
      const byteArray = new Uint8Array(binaryString.length)
      for (let j = 0; j < binaryString.length; j++) byteArray[j] = binaryString.charCodeAt(j)

      console.log('[AUDIO] ByteArray size:', byteArray.length)
      const fileName = `audio_${Date.now()}.m4a`

      const { error: uploadError } = await supabase.storage
        .from('message_attachments')
        .upload(`audio/${conversationId}/${fileName}`, byteArray, { contentType: 'audio/m4a', upsert: false })

      if (uploadError) {
        console.error('[AUDIO] Upload error:', uploadError)
        throw uploadError
      }

      console.log('[AUDIO] Upload success, getting URL')
      const { data: urlData } = supabase.storage
        .from('message_attachments')
        .getPublicUrl(`audio/${conversationId}/${fileName}`)

      console.log('[AUDIO] URL:', urlData.publicUrl)
      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: `[AUDIO ${recordedAudio.duration}s]`,
        message_type: 'audio',
        file_url: urlData.publicUrl,
        file_name: fileName,
      })

      if (insertError) {
        console.error('[AUDIO] Insert error:', insertError)
        throw insertError
      }

      console.log('[AUDIO] Message inserted, fetching')
      setRecordedAudio(null)
      setRecordingDuration(0)
      await fetchMessages(conversationId)
      showToast('Message vocal envoyé ✅', 'success')
    } catch (err) {
      console.error('[AUDIO] Error sending audio:', err)
      showToast('Erreur lors de l\'envoi du message vocal: ' + (err instanceof Error ? err.message : 'Inconnu'), 'error')
    } finally {
      setSending(false)
    }
  }

  const cancelRecordedAudio = () => {
    setRecordedAudio(null)
    setRecordingDuration(0)
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={{ flex: 1 }}
      >
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
            const isEncouragement = msg.content?.startsWith('[ENC]')
            const displayContent = isEncouragement ? msg.content!.replace('[ENC]', '') : msg.content

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
                    isEncouragement && !isOwn && styles.messageBubbleEncouragement,
                    (msg as any).message_type === 'image' && { padding: 4, overflow: 'hidden' },
                  ]}
                >
                  {isEncouragement && !isOwn && (
                    <View style={styles.encouragementBadge}>
                      <Text style={styles.encouragementBadgeText}>Encouragement</Text>
                    </View>
                  )}

                  {/* IMAGE message */}
                  {(msg as any).message_type === 'image' && (msg as any).file_url ? (
                    <TouchableOpacity onPress={() => setFullscreenImage((msg as any).file_url)} activeOpacity={0.8}>
                      <View>
                        <Image
                          source={{ uri: (msg as any).file_url }}
                          style={{ width: 200, height: 200, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                        <View style={styles.messageFooter}>
                          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                            {formatExactTime(msg.created_at)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (msg as any).message_type === 'audio' && (msg as any).file_url ? (
                    /* AUDIO message — compact horizontal */
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180, maxWidth: 240 }}
                      onPress={() => playAudio((msg as any).file_url)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={playingUrl === (msg as any).file_url ? 'pause-circle' : 'play-circle'}
                        size={32}
                        color={isOwn ? colors.bg.primary : '#ffd700'}
                      />
                      <View style={{ flex: 1 }}>
                        {/* Progress bar */}
                        <View style={{ height: 3, backgroundColor: isOwn ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 2 }}>
                          {playingUrl === (msg as any).file_url && (() => {
                            const total = parseInt(displayContent?.replace('[AUDIO ', '').replace('s]', '') || '1')
                            return <View style={{ height: 3, width: `${Math.min(100, (playbackPosition / total) * 100)}%` as any, backgroundColor: isOwn ? colors.bg.primary : '#ffd700', borderRadius: 2 }} />
                          })()}
                        </View>
                        <Text style={{ fontSize: 11, color: isOwn ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }}>
                          {playingUrl === (msg as any).file_url
                            ? `${playbackPosition}s / ${displayContent?.replace('[AUDIO ', '').replace(']', '') || ''}`
                            : displayContent?.replace('[AUDIO ', '').replace(']', '') || ''}
                        </Text>
                      </View>
                      <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                        {formatExactTime(msg.created_at)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    /* TEXT message */
                    <>
                      <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                        {displayContent}
                      </Text>
                      <View style={styles.messageFooter}>
                        <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                          {formatExactTime(msg.created_at)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {isOwn && <View style={styles.avatarColOwn} />}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputSection}>
        {isBlocked ? (
          <View style={styles.restrictedMessageBox}>
            <Ionicons name="warning" size={20} color="#ff4444" />
            <Text style={[styles.restrictedText, { marginLeft: 12 }]}>
              Vous avez bloqué cet utilisateur
            </Text>
          </View>
        ) : isBlockedByOther ? (
          <View style={styles.restrictedMessageBox}>
            <Ionicons name="warning" size={20} color="#ff4444" />
            <Text style={[styles.restrictedText, { marginLeft: 12 }]}>
              Cet utilisateur vous a bloqué
            </Text>
          </View>
        ) : isCurrentUserFree ? (
          // Cas 1: User est free → ne peut rien envoyer, doit upgrader
          <View style={styles.restrictedMessageBox}>
            <Ionicons name="lock-closed" size={20} color="#ff9800" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.restrictedTitle}>Messagerie Premium</Text>
              <Text style={styles.restrictedText}>
                Passez à Business pour envoyer des messages
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings?scroll=pro' as any)}
              style={styles.upgradeButton}
            >
              <Text style={styles.upgradeButtonText}>Upgrader</Text>
            </TouchableOpacity>
          </View>
        ) : canSendEncouragement ? (
          // Cas 2: User est business+ et participant est free → peut envoyer un encouragement
          <View style={styles.encouragementBox}>
            <View style={styles.encouragementInfo}>
              <Ionicons name="star" size={20} color="#ffd700" />
              <Text style={styles.encouragementInfoText}>
                {participant?.first_name} n'a pas le plan Business
              </Text>
            </View>
            <TouchableOpacity
              style={styles.encouragementButton}
              onPress={openEncouragementModal}
            >
              <Text style={styles.encouragementButtonText}>Envoyer un encouragement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Cas 3: Les deux sont business+ → input normal
          <View style={styles.inputContainer}>
            {/* Image Selection Preview */}
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <View style={styles.imagePreviewContent}>
                  <Ionicons name="image" size={20} color="#4ade80" />
                  <Text style={styles.imagePreviewText}>{selectedImage.name}</Text>
                </View>
                <View style={styles.imagePreviewActions}>
                  <TouchableOpacity
                    onPress={() => setSelectedImage(null)}
                    style={styles.imagePreviewButton}
                  >
                    <Ionicons name="close" size={18} color="#ff4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={sendSelectedImage}
                    disabled={sending}
                    style={[styles.imagePreviewButton, { backgroundColor: '#4ade80' }]}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Ionicons name="checkmark" size={18} color="#000" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Audio Preview */}
            {recordedAudio && (
              <View style={styles.audioPreviewContainer}>
                <View style={styles.audioPreviewContent}>
                  <Ionicons name="musical-notes" size={20} color="#ffd700" />
                  <Text style={styles.audioPreviewText}>
                    Message vocal ({recordedAudio.duration}s)
                  </Text>
                </View>
                <View style={styles.audioPreviewActions}>
                  <TouchableOpacity
                    onPress={cancelRecordedAudio}
                    style={styles.audioPreviewButton}
                  >
                    <Ionicons name="close" size={18} color="#ff4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={sendRecordedAudio}
                    disabled={sending}
                    style={[styles.audioPreviewButton, { backgroundColor: '#ffd700' }]}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Ionicons name="checkmark" size={18} color="#000" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Recording Timer — tap STOP to finish */}
            {isRecording && (
              <TouchableOpacity
                style={styles.recordingContainer}
                onPress={stopRecording}
                activeOpacity={0.8}
              >
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
                </Text>
                <View style={{ marginLeft: 'auto' as any, backgroundColor: '#ff4444', borderRadius: 20, padding: 6 }}>
                  <Ionicons name="stop" size={16} color="#fff" />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 6 }}>Appuie pour arrêter</Text>
              </TouchableOpacity>
            )}

            {/* Input Row */}
            <View style={styles.inputRow}>
              {/* Photo Button */}
              <TouchableOpacity
                onPress={pickImage}
                disabled={sending || !!selectedImage || isRecording}
                style={styles.photoButton}
              >
                <Ionicons name="image" size={22} color={sending || !!selectedImage || isRecording ? '#ffffff44' : '#4ade80'} />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                style={styles.input}
                placeholder="Écrire un message..."
                placeholderTextColor="#ffffff44"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
                editable={!sending && !isRecording}
              />

              {/* Toggle Microphone Button (click to start, click to stop) */}
              <TouchableOpacity
                style={[
                  styles.micButton,
                  isRecording && styles.micButtonRecording,
                ]}
                onPress={() => {
                  if (isRecording) {
                    stopRecording()
                  } else {
                    startRecording()
                  }
                }}
                disabled={sending || !!recordedAudio}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic-outline'}
                  size={20}
                  color={isRecording ? '#fff' : '#ffd700'}
                />
              </TouchableOpacity>

              {/* Send Text Button */}
              {messageText.trim() && !recordedAudio && (
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons name="send" size={18} color="#000" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Encouragement Modal */}
      <Modal
        visible={showEncouragementModal}
        transparent
        animationType="fade"
        onRequestClose={closeEncouragementModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="star" size={36} color="#ffd700" />
            </View>
            <Text style={styles.modalTitle}>Envoyer un encouragement ?</Text>
            <Text style={styles.modalDescription}>
              Un encouragement est un message qui invite {participant?.first_name} à passer au plan Business pour pouvoir discuter avec vous.{'\n\n'}
              Le destinataire pourra lire votre message mais devra prendre le plan Business pour vous répondre.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closeEncouragementModal}
                disabled={sendingEncouragement}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  sendingEncouragement && styles.modalButtonDisabled
                ]}
                onPress={handleSendEncouragement}
                disabled={sendingEncouragement}
              >
                {sendingEncouragement ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Image Modal */}
      <Modal visible={!!fullscreenImage} transparent onRequestClose={() => setFullscreenImage(null)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }} onPress={() => setFullscreenImage(null)}>
            {fullscreenImage && <Image source={{ uri: fullscreenImage }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
          </TouchableOpacity>
          <TouchableOpacity style={{ position: 'absolute', top: 40, left: 20 }} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const getStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.tertiary,
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
    borderTopColor: colors.bg.tertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.tertiary,
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
    backgroundColor: colors.bg.tertiary,
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

  // Encouragement styles
  encouragementBox: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  encouragementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  encouragementInfoText: {
    color: '#ffffff99',
    fontSize: 13,
    flex: 1,
  },
  encouragementButton: {
    backgroundColor: '#ffd700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  encouragementButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },

  // Encouragement message bubble
  messageBubbleEncouragement: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  encouragementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.2)',
  },
  encouragementBadgeText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,215,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDescription: {
    color: '#ffffffbb',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalTextInput: {
    backgroundColor: colors.bg.primary,
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 4,
  },
  modalCharCount: {
    color: '#ffffff66',
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#ffd700',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonPrimaryText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  modalButtonSecondaryText: {
    color: '#ffffffaa',
    fontSize: 15,
    fontWeight: '600',
  },

  // Image and Media Styles
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  imagePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  imagePreviewText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  imagePreviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  imagePreviewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff11',
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  photoButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Audio Recording Styles
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    marginBottom: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  audioPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ffd700',
  },
  audioPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  audioPreviewText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  audioPreviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  audioPreviewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff11',
    justifyContent: 'center',
    alignItems: 'center',
  },

  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff11',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#ff4444',
  },
})
