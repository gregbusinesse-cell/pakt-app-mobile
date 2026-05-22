import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { cleanPhotoUrls } from '@/lib/utils';
import type { Profile } from '@/lib/types';

interface Props {
  visible: boolean;
  myProfile: Profile | null;
  matchedProfile: Profile | null;
  onClose: () => void;
  onMessage?: () => void;
}

export default function MatchModal({
  visible,
  myProfile,
  matchedProfile,
  onClose,
  onMessage,
}: Props) {
  if (!matchedProfile) return null;

  const myPhotos = cleanPhotoUrls(myProfile?.photos);
  const otherPhotos = cleanPhotoUrls(matchedProfile.photos);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>C'est un Match !</Text>
          <Text style={styles.subtitle}>
            Toi et {matchedProfile.first_name || 'cette personne'} avez matche
          </Text>

          <View style={styles.avatars}>
            <View style={styles.avatarWrapper}>
              {myPhotos[0] ? (
                <Image source={{ uri: myPhotos[0] }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>
            <View style={styles.heartIcon}>
              <Ionicons name="heart" size={24} color={Colors.gold} />
            </View>
            <View style={styles.avatarWrapper}>
              {otherPhotos[0] ? (
                <Image source={{ uri: otherPhotos[0] }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>
          </View>

          {onMessage && (
            <TouchableOpacity style={styles.messageButton} onPress={onMessage}>
              <Text style={styles.messageButtonText}>Envoyer un message</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Continuer a swiper</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.dark200,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.2)',
    padding: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 32,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    borderWidth: 3,
    borderColor: Colors.gold,
    borderRadius: 50,
    padding: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.dark300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,168,83,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -8,
    zIndex: 1,
  },
  messageButton: {
    width: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  messageButtonText: {
    color: Colors.dark,
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
});
