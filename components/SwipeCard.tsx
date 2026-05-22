import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { cleanPhotoUrls, cleanStringArray, parseSkills } from '@/lib/utils';
import type { Profile } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface Props {
  profile: Profile;
  onSwipe: (dir: 'left' | 'right') => void;
  onUndo?: () => void;
  canUndo?: boolean;
  hasLikedYou?: boolean;
  isTop?: boolean;
}

export default function SwipeCard({
  profile,
  onSwipe,
  onUndo,
  canUndo = false,
  hasLikedYou,
  isTop = false,
}: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const photos = cleanPhotoUrls(profile.photos);
  const interests = cleanStringArray(profile.interests);
  const skills = parseSkills(profile.skills);
  const safeIndex = photos.length > 0 ? photoIndex % photos.length : 0;

  const fireSwipe = (dir: 'left' | 'right') => {
    onSwipe(dir);
  };

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 250 });
        runOnJS(fireSwipe)('right');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 250 });
        runOnJS(fireSwipe)('left');
      } else {
        translateX.value = withSpring(0, { stiffness: 300, damping: 20 });
        translateY.value = withSpring(0, { stiffness: 300, damping: 20 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value * 0.3 },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-8, 0, 8])}deg` },
    ],
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 80], [0, 1]),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, 0], [1, 0]),
  }));

  const handleButtonSwipe = (dir: 'left' | 'right') => {
    const target = dir === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
    translateX.value = withTiming(target, { duration: 300 });
    setTimeout(() => fireSwipe(dir), 200);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Photo */}
        <View style={styles.photoContainer}>
          {photos.length > 0 ? (
            <Image source={{ uri: photos[safeIndex] }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={80} color="rgba(255,255,255,0.2)" />
            </View>
          )}

          {/* Photo dots */}
          {photos.length > 1 && (
            <View style={styles.dotsContainer}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === safeIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Photo tap zones */}
          {photos.length > 1 && (
            <>
              <TouchableOpacity
                style={styles.tapLeft}
                activeOpacity={1}
                onPress={() => setPhotoIndex((p) => (p - 1 + photos.length) % photos.length)}
              />
              <TouchableOpacity
                style={styles.tapRight}
                activeOpacity={1}
                onPress={() => setPhotoIndex((p) => (p + 1) % photos.length)}
              />
            </>
          )}

          {/* Like/Nope overlays */}
          <Animated.View style={[styles.labelOverlay, styles.labelLike, likeOpacity]}>
            <Text style={styles.labelLikeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.labelOverlay, styles.labelNope, nopeOpacity]}>
            <Text style={styles.labelNopeText}>NOPE</Text>
          </Animated.View>

          {/* Liked you badge */}
          {hasLikedYou && (
            <View style={styles.likedBadge}>
              <Text style={styles.likedBadgeText}>T'a like</Text>
            </View>
          )}

          {/* Name overlay */}
          <View style={styles.nameOverlay}>
            <Text style={styles.name}>
              {profile.first_name || 'Profil'}
              {profile.age ? `, ${profile.age}` : ''}
            </Text>
            {profile.city && (
              <Text style={styles.city}>{profile.city}</Text>
            )}
          </View>
        </View>

        {/* Info section */}
        <View style={styles.info}>
          {profile.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {profile.bio}
            </Text>
          )}

          {interests.length > 0 && (
            <View style={styles.chips}>
              {interests.slice(0, 5).map((interest) => (
                <View key={interest} style={styles.chip}>
                  <Text style={styles.chipText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}

          {skills.length > 0 && (
            <View style={styles.skillsContainer}>
              {skills.slice(0, 3).map((skill) => (
                <View key={skill.name} style={styles.skillRow}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <View style={styles.skillDots}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.skillDot,
                          i < skill.level && styles.skillDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action buttons */}
        {isTop && (
          <View style={styles.actions}>
            {canUndo && onUndo && (
              <TouchableOpacity style={styles.undoButton} onPress={onUndo}>
                <Ionicons name="arrow-undo" size={20} color={Colors.gold} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.nopeButton}
              onPress={() => handleButtonSwipe('left')}
            >
              <Ionicons name="close" size={28} color="#ff4458" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => handleButtonSwipe('right')}
            >
              <Ionicons name="heart" size={28} color={Colors.gold} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.dark200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: Colors.dark300,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark300,
  },
  dotsContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  labelOverlay: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  labelLike: {
    left: 20,
    borderColor: '#00cc66',
    transform: [{ rotate: '-15deg' }],
  },
  labelLikeText: {
    color: '#00cc66',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  labelNope: {
    right: 20,
    borderColor: '#ff4458',
    transform: [{ rotate: '15deg' }],
  },
  labelNopeText: {
    color: '#ff4458',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  likedBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  likedBadgeText: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '700',
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  city: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  info: {
    padding: 16,
    gap: 12,
  },
  bio: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.dark300,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  skillsContainer: {
    gap: 8,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    flex: 1,
  },
  skillDots: {
    flexDirection: 'row',
    gap: 3,
  },
  skillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skillDotFilled: {
    backgroundColor: Colors.gold,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  undoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nopeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,68,88,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,68,88,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(212,168,83,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
