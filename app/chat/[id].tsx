import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { formatTime, cleanPhotoUrls, normalizePlan, isPaidPlan, canChat } from '@/lib/utils';
import { mockMessages, mockProfiles } from '@/lib/mock-data';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Message, Profile } from '@/lib/types';
import * as ImagePicker from 'expo-image-picker';

export default function ChatScreen() {
  const { id: conversationId, userId } = useLocalSearchParams<{ id: string; userId?: string }>();
  const router = useRouter();
  const { profile, refreshNotifications } = useAppStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const myPlan = normalizePlan(profile?.plan);
  const otherPlan = normalizePlan(otherUser?.plan);
  const bothCanChat = canChat(myPlan, otherPlan);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setCurrentUserId('current_user');
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (USE_MOCK_DATA) {
      const user = mockProfiles.find((p) => p.id === userId);
      if (user) setOtherUser(user);
    }
  }, [userId]);

  const loadMessages = useCallback(() => {
    if (!conversationId) return;
    setLoading(true);

    if (USE_MOCK_DATA) {
      // Charger les messages mock
      setTimeout(() => {
        setMessages(mockMessages as Message[]);
        setLoading(false);
      }, 200);
      return;
    }

    // Production mode: load from Supabase
    // TODO: Implement Supabase message loading
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [conversationId, loadMessages]);

  const markAsRead = useCallback(() => {
    if (!conversationId || !currentUserId) return;

    if (USE_MOCK_DATA) {
      // Mock mode: just refresh notifications
      refreshNotifications();
      return;
    }

    // Production mode: would call Supabase
    // TODO: Implement Supabase message marking
  }, [conversationId, currentUserId, refreshNotifications]);

  useEffect(() => {
    if (messages.length > 0) markAsRead();
  }, [messages.length, markAsRead]);

  useEffect(() => {
    // Realtime subscriptions disabled in mock mode
    if (USE_MOCK_DATA || !conversationId) return;
    // TODO: Implement Supabase realtime message subscriptions in production mode
  }, [conversationId]);

  const sendMessage = () => {
    if (!text.trim() || !currentUserId || !conversationId || sending) return;

    setSending(true);
    const content = text.trim();
    setText('');

    if (USE_MOCK_DATA) {
      // Mock mode: add message to local state
      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        conversation_id: conversationId,
        conversation_type: 'match',
        sender_id: currentUserId,
        content,
        message_type: 'text',
        file_url: null,
        file_name: null,
        file_size: null,
        is_read: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setSending(false);
      return;
    }

    // Production mode: would call Supabase
    // TODO: Implement Supabase message insertion
    Alert.alert('Mode développement', 'À implémenter en production');
    setSending(false);
  };

  const sendImage = async () => {
    if (!currentUserId || !conversationId) return;

    if (USE_MOCK_DATA) {
      // Mock mode: just show a placeholder
      Alert.alert('Mode développement', 'Envoi d\'images à implémenter');
      return;
    }

    // Production mode: would pick image, upload to Supabase storage, and send message
    // TODO: Implement image upload and message creation
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    // Image upload logic would go here
    Alert.alert('Mode développement', 'À implémenter en production');
  };

  const isOnline = otherUser?.updated_at
    ? new Date(otherUser.updated_at).getTime() > Date.now() - 5 * 60 * 1000
    : false;

  const otherPhotos = cleanPhotoUrls(otherUser?.photos);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === currentUserId;

    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.message_type === 'image' && item.file_url ? (
            <Image source={{ uri: item.file_url }} style={styles.messageImage} />
          ) : item.message_type === 'audio' && item.file_url ? (
            <View style={styles.audioContainer}>
              <Ionicons name="play" size={20} color={isMine ? Colors.dark : Colors.gold} />
              <Text style={[styles.audioText, isMine && styles.audioTextMine]}>
                Message vocal
              </Text>
            </View>
          ) : (
            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
              {item.content}
            </Text>
          )}
          <Text style={[styles.timeText, isMine && styles.timeTextMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {otherPhotos[0] ? (
            <Image source={{ uri: otherPhotos[0] }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Ionicons name="person" size={16} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View>
            <Text style={styles.headerName}>
              {otherUser?.first_name || 'Profil'}
            </Text>
            <Text style={styles.headerStatus}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
          {isOnline && <View style={styles.headerOnline} />}
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input bar */}
      {bothCanChat ? (
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachButton} onPress={sendImage}>
            <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            maxLength={2000}
          />
          {text.trim() ? (
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
              <Ionicons name="send" size={20} color={Colors.dark} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micButton}>
              <Ionicons name="mic" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.lockedBar}>
          <Ionicons name="lock-closed" size={16} color={Colors.gold} />
          <Text style={styles.lockedText}>
            {isPaidPlan(myPlan)
              ? 'Ce membre doit passer Business pour discuter'
              : 'Passe Business pour envoyer des messages'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark100,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark400,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark300,
  },
  headerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  headerOnline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginLeft: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.dark200,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextMine: {
    color: Colors.dark,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  audioText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  audioTextMine: {
    color: Colors.dark,
  },
  timeText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeTextMine: {
    color: 'rgba(0,0,0,0.4)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    backgroundColor: Colors.dark100,
    borderTopWidth: 0.5,
    borderTopColor: Colors.dark400,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.dark200,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    backgroundColor: Colors.dark100,
    borderTopWidth: 0.5,
    borderTopColor: Colors.dark400,
  },
  lockedText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
});
