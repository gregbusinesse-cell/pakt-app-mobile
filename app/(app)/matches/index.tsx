import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert, ToastAndroid } from 'react-native'
import { useMatches } from '@/lib/hooks/useMatches'
import { useRouter } from 'expo-router'
import { ProfileImage } from '@/components/ProfileImage'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'
import { BlurView } from 'expo-blur'

export default function MatchesPage() {
  const router = useRouter()
  const { matches, likes, loading, error, reload } = useMatches()
  const [userPlan, setUserPlan] = useState<string>('free')
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'matches' | 'likes'>('matches')

  // Get current user and plan
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user?.id) {
        setUserId(data.session.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', data.session.user.id)
          .single()
        setUserPlan((profile?.plan || 'free').toLowerCase())
      }
    })
  }, [])

  const unreadMatchCount = matches.filter((m) => !m.isViewed).length
  const unreadLikeCount = likes.filter((l) => !l.isViewed).length
  const totalNotifications = unreadMatchCount + unreadLikeCount

  const handleMatchPress = async (matchId: string) => {
    // Mark as viewed and navigate to conversation
    await supabase.from('matches').update({ is_viewed: true }).eq('id', matchId)
    router.push('/messages')
  }

  const handleLikePress = async (likeId: string) => {
    if (userPlan !== 'business_pro' || !userId) {
      // Can't view, notification stays
      return
    }

    try {
      // Find the like item to get the liker's ID
      const likeItem = likes.find((l) => l.likeId === likeId)
      if (!likeItem) {
        console.error('[MATCHES] Like item not found')
        return
      }

      const otherUserId = likeItem.otherUser.id
      const otherUserPlan = (likeItem.otherUser.plan || 'free').toLowerCase()

      // Step 1: Create a like back (current user likes the person who liked them)
      // The database trigger will automatically create a match
      console.log('[MATCHES] Creating like back:', { userId, otherUserId })

      const { data: likeBackData, error: likeBackError } = await supabase
        .from('likes')
        .upsert(
          {
            liker_id: userId,
            liked_id: otherUserId,
          },
          {
            onConflict: 'liker_id,liked_id',
          }
        )
        .select()

      console.log('[MATCHES] Like back result:', { data: likeBackData, error: likeBackError })

      if (likeBackError) {
        console.error('[MATCHES] Like back error - CRITICAL', likeBackError)
        Alert.alert('Erreur', 'Impossible de liker : ' + likeBackError.message)
        return
      }

      // Step 1b: Record swipe for tracking (same as web app)
      const { error: swipeError } = await supabase
        .from('swipes')
        .upsert(
          {
            swiper_id: userId,
            target_id: otherUserId,
            action: 'like',
          },
          {
            onConflict: 'swiper_id,target_id',
          }
        )

      if (swipeError) {
        console.error('[MATCHES] Swipe recording error', swipeError)
        // Don't fail if swipe recording fails
      }

      // Step 2: Mark original like as viewed
      const { error: viewError } = await supabase
        .from('likes')
        .update({ is_viewed: true })
        .eq('id', likeId)

      if (viewError) {
        console.error('[MATCHES] Error marking like as viewed', viewError)
        // Don't fail if marking viewed fails
      }

      // Step 3: Check if both users have paid plan (business or business_pro) before creating conversation
      console.log('[MATCHES] User plans:', { userPlan, otherUserPlan })
      const bothCanChat = (userPlan === 'business' || userPlan === 'business_pro') &&
                          (otherUserPlan === 'business' || otherUserPlan === 'business_pro')

      if (!bothCanChat) {
        // Show message that match was created but they need Business plan to chat
        console.log('[MATCHES] Match created but Business plan required to chat', { userPlan, otherUserPlan })
        Alert.alert(
          'Nouveau match!',
          'Vous devez tous les deux avoir un plan payant (Business ou Business Pro) pour discuter',
          [{ text: 'OK' }]
        )
        return
      }

      // Step 4: Get or create conversation (both users are paid)
      const { data: conversationId, error: convError } = await supabase
        .rpc('get_or_create_conversation', {
          other_user_id: otherUserId,
        })

      if (convError) {
        console.error('[MATCHES] Conversation creation error', convError)
      }

      // Recharger les données pour que la personne passe de "Likes" à "Matchs"
      console.log('[MATCHES] Reloading data...')
      await reload()
      console.log('[MATCHES] Data reloaded, navigating to messages')

      // Afficher un toast de succès
      ToastAndroid.show('Match créé ! Conversation lancée 🎉', ToastAndroid.SHORT)

      // Attendre un peu pour s'assurer que les données sont à jour
      await new Promise(resolve => setTimeout(resolve, 500))

      // Navigate to messages
      router.push('/messages')
    } catch (error) {
      console.error('[MATCHES] handleLikePress error', error)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={{ color: '#fff', marginTop: 16 }}>Chargement...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matchs</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Ionicons
            name="heart"
            size={18}
            color={activeTab === 'matches' ? '#ffd700' : '#ffffff66'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'matches' && styles.tabLabelActive,
            ]}
          >
            Matchs
          </Text>
          {unreadMatchCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadMatchCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
          onPress={() => setActiveTab('likes')}
        >
          <Ionicons
            name="flame"
            size={18}
            color={activeTab === 'likes' ? '#ff6b35' : '#ffffff66'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'likes' && styles.tabLabelActive,
            ]}
          >
            Likes
          </Text>
          {unreadLikeCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadLikeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Erreur: {error}</Text>
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
                  onPress={() => handleMatchPress(item.id)}
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
                    <Text style={styles.gridCity} numberOfLines={1}>
                      {item.otherUser.city || 'Non spécifié'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color="#ffffff44" />
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
                    onPress={() => handleLikePress(item.likeId)}
                    disabled={userPlan !== 'business_pro'}
                    activeOpacity={userPlan === 'business_pro' ? 0.8 : 1}
                  >
                    {!item.isViewed && <View style={styles.gridNewBadge} />}
                    <ProfileImage
                      photos={item.otherUser.photos as any}
                      style={styles.gridImage}
                      placeholder={styles.gridImagePlaceholder}
                    />

                    {/* Blur overlay for FREE users */}
                    {userPlan !== 'business_pro' && (
                      <BlurView intensity={90} style={styles.blurOverlay}>
                        <View style={styles.lockedContainer}>
                          <Ionicons name="lock-closed" size={32} color="#ffd700" />
                          <Text style={styles.lockedText}>Verrouillé</Text>
                        </View>
                      </BlurView>
                    )}

                    {userPlan === 'business_pro' && (
                      <View style={styles.gridOverlay}>
                        <Text style={styles.gridName} numberOfLines={1}>
                          {item.otherUser.first_name}, {item.otherUser.age}
                        </Text>
                        <Text style={styles.gridCity} numberOfLines={1}>
                          {item.otherUser.city || 'Non spécifié'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Paywall for FREE users */}
              {userPlan !== 'business_pro' && (
                <View style={styles.paywallContainer}>
                  <View style={styles.paywallCard}>
                    <Ionicons name="lock-closed" size={28} color="#ffd700" />
                    <Text style={styles.paywallTitle}>Déverrouille les likes</Text>
                    <Text style={styles.paywallText}>
                      Passe à Business Pro pour voir qui t'a liké et pouvoir les liker en retour
                    </Text>
                    <TouchableOpacity
                      style={styles.paywallButton}
                      onPress={() => router.push('/settings')}
                    >
                      <Text style={styles.paywallButtonText}>Découvrir Business Pro</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={48} color="#ffffff44" />
              <Text style={styles.emptyTitle}>Pas de likes reçus</Text>
              <Text style={styles.emptyText}>Les personnes qui te likent apparaîtront ici</Text>
            </View>
          )}
        </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  )
}

const { width } = Dimensions.get('window')
const gridItemSize = (width - 64) / 2

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },

  /* Tab Navigation */
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ffd700',
  },
  tabLabel: {
    color: '#ffffff66',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Content */
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },

  errorContainer: {
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#661111',
  },
  errorText: {
    color: '#ff6666',
    fontSize: 13,
  },

  /* Section */
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridCard: {
    width: gridItemSize,
    height: gridItemSize,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
  gridNewBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4444',
    borderWidth: 2,
    borderColor: '#000',
    zIndex: 20,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  gridName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  gridCity: {
    color: '#ffffff88',
    fontSize: 12,
    marginTop: 4,
  },

  /* Blur overlay for locked likes */
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  lockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  lockedText: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Paywall */
  paywallContainer: {
    marginTop: 20,
  },
  paywallCard: {
    backgroundColor: '#ffd70015',
    borderWidth: 1,
    borderColor: '#ffd70044',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
  },
  paywallTitle: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '700',
  },
  paywallText: {
    color: '#ffffff88',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  paywallButton: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  paywallButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#ffffff66',
    fontSize: 14,
    marginTop: 8,
  },
})
