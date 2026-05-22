import { useCallback, useEffect, useState } from 'react';
import { USE_MOCK_DATA } from '@/lib/config';
import { mockProfiles, mockMatches, mockLikes, mockConversations, mockMessages } from '@/lib/mock-data';
import type { Profile, Match, Like, Conversation, Message } from '@/lib/types';

export function useProfilesData() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Simuler un délai de chargement
      setTimeout(() => {
        setProfiles(mockProfiles);
        setLoading(false);
      }, 500);
    }
  }, []);

  return { profiles, loading, error };
}

export function useMatchesData() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setMatches(mockMatches);
        setLikes(mockLikes);
        setLoading(false);
      }, 300);
    }
  }, []);

  return { matches, likes, loading };
}

export function useConversationsData() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setConversations(mockConversations);
        setLoading(false);
      }, 300);
    }
  }, []);

  return { conversations, loading };
}

export function useMessagesData(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        if (conversationId === 'conv1') {
          setMessages(mockMessages);
        }
        setLoading(false);
      }, 200);
    }
  }, [conversationId]);

  return { messages, loading };
}
