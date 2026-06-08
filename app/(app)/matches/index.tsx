import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMatches } from '@/lib/hooks/useMatches'
import { useRouter } from 'expo-router'
import { ProfileImage } from '@/components/ProfileImage'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import { refreshNotificationCount } from '@/lib/hooks/useNotificationCount'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'

export default function MatchesPage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { matches, likes, loading, error, reload } = useMatches()
  const [userPlan, setUserPlan] = useState<string>('free')
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'matches' | 'likes'>('matches')

  const fadeAnim = useRef(new Animated.Value(0)).current
  const tabSlideAnim = useRef(new Animated.Value(0)).current

  // Get current user and plan
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user?.id) {
        setUserId(data.session.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', data.session.user.id)
          .single()
        setUserPlan((profile?.subscription_plan || 'free').toLowerCase())
      }
    })
  }, [])

  // Mark ALL matches and likes as viewed when arriving on the page
  useEffect(() => {
    if (!userId) return

    const markAllAsViewed = async () => {
      console.log('[MATCHES] === AUTO-MARK START === userId:', userId)

      try {
        // 1. Fetch ALL unviewed matches for this user
        const { data: unviewedMatches, error: matchFetchErr } = await supabase
          .from('matches')
          .select('id')
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .eq('is_viewed', false)

        if (!matchFetchErr && unviewedMatches && unviewedMatches.length > 0) {
          const matchIds = unviewedMatches.map((m: any) => m.id)
          await supabase
            .from('matches')
            .update({ is_viewed: true })
            .in('id', matchIds)
          console.log('[MATCHES] ✅ Updated matches:', unviewedMatches.length)
        }

        // 2. Fetch ALL unviewed likes received by this user
        const { data: unviewedLikes, error: likeFetchErr } = await supabase
          .from('likes')
          .select('id')
          .eq('liked_id', userId)
          .eq('is_viewed', false)

        if (!likeFetchErr && unviewedLikes && unviewedLikes.length > 0) {
          const likeIds = unviewedLikes.map((l: any) => l.id)
          await supabase
            .from('likes')
            .update({ is_viewed: true })
            .in('id', likeIds)
          console.log('[MATCHES] ✅ Updated likes:', unviewedLikes.length)
        }

        // 3. Refresh the navbar badge counters
        if (userId) {
          await refreshNotificationCount(userId)
        }

        // 4. Reload the page data
        reload()
        console.log('[MATCHES] === AUTO-MARK END ===')
      } catch (err) {
        console.error('[MATCHES] ❌ Exception in markAllAsViewed:', err)
      }
    }

    markAllAsViewed()
  }, [userId])

  // Animate on load
  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitions.normal,
        useNativeDriver: true,
      }).start()
    }
  }, [loading])

  const handleMatchPress = async (matchId: string, otherUserId: string) => {
    await supabase.from('matches').update({ is_viewed: true }).eq('id', matchId)
    if (userId) {
      await refreshNotificationCount(userId)
    }
    router.push(`/user/${otherUserId}` as any)
  }

  const handleLikePress = async (likeId: string, otherUserId: string) => {
    if (userPlan !== 'business_pro' || !userId) return

    try {
      await supabase.from('likes').update({ is_viewed: true }).eq('id', likeId)
      if (userId) {
        await refreshNotificationCount(userId)
      }
      router.push(`/user/${otherUserId}` as any)
    } catch (error) {
      console.error('[MATCHES] handleLikePress error', error)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    )
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {activeTab === 'matches' ? 'Matchs' : 'Likes'}
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'matches' ? 'heart' : 'heart-outline'}
            size={20}
            color={activeTab === 'matches' ? colors.bg.primary : colors.text.tertiary}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'matches' && styles.tabLabelActive,
            ]}
          >
            Matchs
          </Text>
          {matches.length > 0 && (
            <View style={styles.tabCounter}>
              <Text style={styles.tabCounterText}>{matches.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
          onPress={() => setActiveTab('likes')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'likes' ? 'flame' : 'flame-outline'}
            size={20}
            color={activeTab === 'likes' ? colors.bg.primary : colors.text.tertiary}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'likes' && styles.tabLabelActive,
            ]}
          >
            Likes
          </Text>
          {likes.length > 0 && (
            <View style={styles.tabCounter}>
              <Text style={styles.tabCounterText}>{likes.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: spacing.md }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <View style={styles.section}>
            {matches.length > 0 ? (
              <View style={styles.grid}>
                {matches.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.gridCard}
                    onPress={() => handleMatchPress(item.id, item.otherUser.id)}
                    activeOpacity={0.8}
                  >
                    {!item.isViewed && <View style={styles.gridNewBadge} />}
                    <ProfileImage
                      photos={item.otherUser.photos as any}
                      style={styles.gridImage}
                      placeholder={styles.gridImagePlaceholder}
                    />
                    <View style={styles.gridOverlay}>
                      <Text style={styles.gridName} numberOfLines={1}>
                        {item.otherUser.first_name}, {item.otherUser.age}
                      </Text>
                      {item.otherUser.city && (
                        <View style={styles.gridLocationBadge}>
                          <Ionicons name="location" size={10} color={colors.primary} />
                          <Text style={styles.gridCity} numberOfLines={1}>
                            {item.otherUser.city}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={56} color={colors.text.disabled} />
                <Text style={styles.emptyTitle}>Pas encore de matchs</Text>
                <Text style={styles.emptyText}>Continue à swiper pour trouver tes matchs !</Text>
              </View>
            )}
          </View>
        )}

        {/* LIKES TAB */}
        {activeTab === 'likes' && (
          <View style={styles.section}>
            {likes.length > 0 ? (
              <>
                <View style={styles.grid}>
                  {likes.map((item) => (
                    <TouchableOpacity
                      key={item.likeId}
                      style={styles.gridCard}
                      onPress={() => handleLikePress(item.likeId, item.otherUser.id)}
                      disabled={userPlan !== 'business_pro'}
                      activeOpacity={userPlan === 'business_pro' ? 0.8 : 1}
                    >
                      {!item.isViewed && <View style={styles.gridNewBadge} />}

                      {/* For Business Pro: Show photo */}
                      {userPlan === 'business_pro' && (
                        <>
                          <ProfileImage
                            photos={item.otherUser.photos as any}
                            style={styles.gridImage}
                            placeholder={styles.gridImagePlaceholder}
                          />
                          <View style={styles.gridOverlay}>
                            <Text style={styles.gridName} numberOfLines={1}>
                              {item.otherUser.first_name}, {item.otherUser.age}
                            </Text>
                            {item.otherUser.city && (
                              <View style={styles.gridLocationBadge}>
                                <Ionicons name="location" size={10} color={colors.primary} />
                                <Text style={styles.gridCity} numberOfLines={1}>
                                  {item.otherUser.city}
                                </Text>
                              </View>
                            )}
                          </View>
                        </>
                      )}

                      {/* For FREE/BUSINESS: Black screen + lock */}
                      {userPlan !== 'business_pro' && (
                        <View style={[styles.gridImage, styles.blackScreen]}>
                          <View style={styles.lockedContainer}>
                            <Ionicons name="lock-closed" size={36} color={colors.primary} />
                            <Text style={styles.lockedText}>Verrouillé</Text>
                            <Text style={styles.lockedSubtext}>Pro</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Paywall for FREE users */}
                {userPlan !== 'business_pro' && (
                  <View style={styles.paywallContainer}>
                    <View style={styles.paywallCard}>
                      <Ionicons name="lock-closed" size={32} color={colors.primary} />
                      <Text style={styles.paywallTitle}>Déverrouille les likes</Text>
                      <Text style={styles.paywallText}>
                        Passe à Business Pro pour voir qui t'a liké et découvrir tes talents secrets
                      </Text>
                      <TouchableOpacity
                        style={styles.paywallButton}
                        onPress={() => router.push('/settings' as any)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trophy" size={16} color={colors.bg.primary} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.paywallButtonText}>Passer Business Pro</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="flame-outline" size={56} color={colors.text.disabled} />
                <Text style={styles.emptyTitle}>Pas de likes reçus</Text>
                <Text style={styles.emptyText}>Les personnes qui te likent apparaîtront ici</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Animated.View>
  )
}

const { width } = Dimensions.get('window')
const gridItemSize = Math.floor((width - spacing.lg * 2 - spacing.md) / 2)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontSize: 14,
    fontWeight: '500',
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

  // Tab Navigation — pronounced segmented-pill control (Tinder-style)
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.secondary,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  tabLabel: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.bg.primary,
    fontWeight: '800',
  },
  tabCounter: {
    backgroundColor: colors.bg.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.xs,
  },
  tabCounterText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Section
  section: {
    marginBottom: spacing.xxxl,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'flex-start',
  },
  gridCard: {
    width: gridItemSize,
    height: gridItemSize,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    position: 'relative',
    ...shadows.md,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.quaternary,
  },
  gridNewBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.errorDark,
    borderWidth: 2,
    borderColor: colors.bg.primary,
    zIndex: 20,
    ...shadows.glow,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  gridName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  gridLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  gridCity: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '500',
  },

  // Locked Container
  lockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  lockedText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lockedSubtext: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '500',
  },
  blackScreen: {
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Paywall
  paywallContainer: {
    marginTop: spacing.xxl,
  },
  paywallCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
    ...shadows.sm,
  },
  paywallTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  paywallText: {
    color: colors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  paywallButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.glow,
  },
  paywallButtonText: {
    color: colors.bg.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.lg,
    letterSpacing: 0.2,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
})
