import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Linking, ToastAndroid, Platform, TextInput } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
// import { useInAppPurchases } from '@/lib/hooks/useInAppPurchases' // Disabled for MVP - Android compatibility
import { LEGAL_SECTIONS, SUPPORT_EMAIL, LEGAL_CONTENT } from '@/lib/constants/legal-content'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'

// ─── Coming Soon component ────────────────────────────────────────────────────
function ComingSoon({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={csStyles.container}>
      <View style={csStyles.iconCircle}>
        <Ionicons name={icon as any} size={40} color="#d4a853" />
      </View>
      <Text style={csStyles.label}>Bientôt disponible</Text>
      <Text style={csStyles.title}>{title}</Text>
      <Text style={csStyles.subtitle}>{subtitle}</Text>
      <View style={csStyles.dotsRow}>
        {[0, 1, 2].map(i => <View key={i} style={csStyles.dot} />)}
      </View>
    </View>
  )
}

const csStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
  },
})

export default function SettingsPage() {
  const router = useRouter()
  const { scroll } = useLocalSearchParams<{ scroll?: string }>()
  const scrollViewRef = useRef<ScrollView>(null)
  const proCardRef = useRef<View>(null)
  const proCardY = useRef<number>(0)

  // IAP Hook - Disabled for MVP
  // const { loading: iapLoading, error: iapError, requestPurchase } = useInAppPurchases()

  const [activeTab, setActiveTab] = useState<'plans' | 'events' | 'news' | 'referral' | 'legal' | 'compte'>('plans')
  const [currentPlan, setCurrentPlan] = useState<'FREE' | 'BUSINESS' | 'BUSINESS PRO'>('FREE')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState('')
  const [referralLoading, setReferralLoading] = useState(false)
  const [selectedLegal, setSelectedLegal] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isSuspended, setIsSuspended] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [referralLink, setReferralLink] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeUsed, setCodeUsed] = useState(false)
  const [claimingReward, setClaimingReward] = useState<number | null>(null)
  const [selectedNews, setSelectedNews] = useState<{ id: number; title: string; date: string; category: string; content: string; fullContent: string } | null>(null)
  const [showNewsDetail, setShowNewsDetail] = useState(false)
  const [downgradingLoading, setDowngradingLoading] = useState(false)
  const [userPlan, setUserPlan] = useState<'free' | 'business' | 'business_pro'>('free')
  const [activeRewards, setActiveRewards] = useState<any[]>([])
  const [rewardCountdowns, setRewardCountdowns] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          setLoading(false)
          return
        }

        setUserId(session.user.id)
        if (session.user.email) setUserEmail(session.user.email)

        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_plan, is_suspended')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.error('Error fetching subscription:', error)
          setCurrentPlan('FREE')
        } else if (data) {
          const planMap: { [key: string]: 'FREE' | 'BUSINESS' | 'BUSINESS PRO' } = {
            'free': 'FREE',
            'business': 'BUSINESS',
            'business_pro': 'BUSINESS PRO',
            'pro': 'BUSINESS PRO',
          }
          // Use subscription_plan as ONLY source of truth
          const planValue = data.subscription_plan
          console.log('[SETTINGS] User plan:', planValue)
          setCurrentPlan(planMap[planValue?.toLowerCase()] || 'FREE')
          setUserPlan(planValue?.toLowerCase() as any)
          setIsSuspended(!!(data as any).is_suspended)
        }

        // Fetch active rewards
        const { data: rewards } = await supabase
          .from('referral_rewards')
          .select('*')
          .eq('user_id', session.user.id)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })

        if (rewards) {
          setActiveRewards(rewards)
          // Initialize countdowns
          const countdowns: { [key: string]: string } = {}
          rewards.forEach(r => {
            const now = new Date().getTime()
            const expiresAt = new Date(r.expires_at).getTime()
            const diffMs = expiresAt - now
            if (diffMs > 0) {
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
              const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
              const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
              const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
              countdowns[r.id] = days > 0 ? `${days}j` : `${hours}h ${mins}m`
            }
          })
          setRewardCountdowns(countdowns)
        }

        // Fetch referral code from profiles (where it's actually stored)
        const { data: profileFull } = await supabase
          .from('profiles')
          .select('referral_code, referred_by_code')
          .eq('id', session.user.id)
          .single()

        let code = (profileFull as any)?.referral_code as string | null

        if (!code) {
          // Generate and save referral code in profiles
          code = `REF-${session.user.id.substring(0, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          await supabase.from('profiles').update({ referral_code: code } as any).eq('id', session.user.id)
        }

        setReferralCode(code)
        if ((profileFull as any)?.referred_by_code) setCodeUsed(true)

        // Count how many people used this code (from referrals table)
        const { count } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referral_code', code)

        setReferralCount(count || 0)
      } catch (err) {
        console.error('Error:', err)
        setCurrentPlan('FREE')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  // Live countdown for rewards
  useEffect(() => {
    if (activeRewards.length === 0) return

    const interval = setInterval(() => {
      const countdowns: { [key: string]: string } = {}
      const now = new Date().getTime()

      activeRewards.forEach(r => {
        const expiresAt = new Date(r.expires_at).getTime()
        const diffMs = expiresAt - now

        if (diffMs > 0) {
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          const secs = Math.floor((diffMs % (1000 * 60)) / 1000)

          if (days > 0) {
            countdowns[r.id] = `${days}j ${hours}h`
          } else if (hours > 0) {
            countdowns[r.id] = `${hours}h ${mins}m`
          } else {
            countdowns[r.id] = `${mins}m ${secs}s`
          }
        }
      })

      setRewardCountdowns(countdowns)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeRewards])

  // ── Downgrade to free plan ──────────────────────────────────────────────────
  const handleDowngradeToFree = async () => {
    Alert.alert(
      'Downgrader vers FREE?',
      'Tu vas perdre accès aux fonctionnalités Business. Cette action est irréversible.',
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setDowngradingLoading(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) {
                Alert.alert('Erreur', 'Tu dois être connecté.')
                return
              }

              const { data, error } = await supabase.functions.invoke('cancel-subscription', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })

              if (error || !data?.success) {
                Alert.alert('Erreur', error?.message || data?.error || 'Impossible d\'annuler.')
                return
              }

              Alert.alert('Succès', 'Tu es passé au plan FREE.')
              setCurrentPlan('FREE')
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Erreur réseau.')
            } finally {
              setDowngradingLoading(false)
            }
          },
          style: 'destructive',
        },
      ]
    )
  }

  // ── Use a referral code ──────────────────────────────────────────────────────
  const handleUseCode = async () => {
    if (!inputCode.trim()) return
    setCodeLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Non connecté')

      const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
      const res = await fetch(`${SUPA_URL}/functions/v1/use-referral-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ code: inputCode.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        Alert.alert('Erreur', data.error || 'Code invalide.')
      } else {
        Alert.alert('Code appliqué ✅', 'Le code de parrainage a bien été enregistré !')
        setCodeUsed(true)
        setInputCode('')

        // Refetch referral count for the referrer (the person who owns the code being used)
        // This would need to be done on the referrer's side when they next refresh
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de contacter le serveur.')
    }
    finally { setCodeLoading(false) }
  }

  const handleCopyReferral = async () => {
    try {
      const message = `🚀 Rejoins-moi sur PAKT — le Tinder du business !\n\nTélécharge l'app PAKT, crée ton compte et entre mon code de parrainage dans l'onglet Parrainage :\n\n👉 ${referralCode}\n\nDispo sur Android et bientôt sur iOS.`
      await Clipboard.setStringAsync(message)
      if (Platform.OS === 'android') {
        ToastAndroid.show('Message copié dans le presse-papiers ✓', ToastAndroid.LONG)
      } else {
        Alert.alert('Copié ✓', 'Le message de parrainage a été copié. Colle-le dans un SMS, WhatsApp ou email.')
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de copier.')
    }
  }

  // ── Claim reward ───────────────────────────────────────────────────────────────
  const handleClaimReward = async (requiredCount: number, planDays: string) => {
    setClaimingReward(requiredCount)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Non connecté')

      // Call the database function directly
      const { data, error } = await supabase.rpc('claim_referral_reward', {
        p_required_count: requiredCount,
        p_plan_days: planDays,
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Erreur serveur')

      // Show success with countdown timer
      const expiresAt = new Date(data.expires_at)
      const now = new Date()
      const hoursLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      const daysLeft = Math.ceil(hoursLeft / 24)

      Alert.alert(
        'Récompense récupérée ✅',
        `Ton plan ${planDays} a été activé !`,
        [{ text: 'OK' }]
      )

      // Refetch profile to update plan immediately
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('subscription_plan,plan_expires_at')
        .eq('id', session.user.id)
        .single()

      if (updatedProfile) {
        setUserPlan(updatedProfile.subscription_plan?.toLowerCase() as any)
      }
    } catch (err: any) {
      console.error('[REFERRAL] Claim error:', err)
      Alert.alert('Erreur', err.message || 'Impossible de réclamer la récompense.')
    } finally {
      setClaimingReward(null)
    }
  }

  // ── Scroll to Business Pro when ?scroll=pro ──────────────────────────────────
  useEffect(() => {
    if (scroll === 'pro' && !loading) {
      setActiveTab('plans')
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: proCardY.current, animated: true })
      }, 400)
    }
  }, [scroll, loading])

  // ── Password reset ──────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!userEmail) { Alert.alert('Erreur', 'Email introuvable'); return }
    Alert.alert(
      'Réinitialiser le mot de passe',
      `Un lien sera envoyé à :\n${userEmail}\n\nOuvre-le depuis ton téléphone.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            try {
              const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
              const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch(`${SUPA_URL}/functions/v1/reset-password-request`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': ANON_KEY,
                  'Authorization': `Bearer ${session?.access_token || ''}`,
                },
              })
              const data = await res.json()
              if (data.success) Alert.alert('Email envoyé ✅', 'Vérifie ta boîte mail et clique sur le lien depuis ton téléphone pour choisir un nouveau mot de passe.')
              else Alert.alert('Erreur', data.error || 'Impossible d\'envoyer l\'email.')
            } catch {
              Alert.alert('Erreur réseau', 'Impossible de contacter le serveur.')
            }
          },
        },
      ]
    )
  }

  // ── Account suspension ──────────────────────────────────────────────────────
  const handleSuspendAccount = async () => {
    if (isSuspended) {
      // Reactivate
      Alert.alert(
        'Réactiver mon compte',
        'Ton profil redeviendra visible par les autres membres PAKT.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Réactiver',
            onPress: async () => {
              if (!userId) return
              const { error } = await supabase.from('profiles').update({ is_suspended: false }).eq('id', userId)
              if (error) Alert.alert('Erreur', error.message)
              else { setIsSuspended(false); Alert.alert('Compte réactivé ✅', 'Ton profil est à nouveau visible.') }
            },
          },
        ]
      )
    } else {
      // Suspend
      Alert.alert(
        'Mettre mon compte en pause',
        'Ton profil ne sera plus affiché aux autres membres. Tu pourras le réactiver quand tu veux.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Mettre en pause',
            style: 'destructive',
            onPress: async () => {
              if (!userId) return
              const { error } = await supabase.from('profiles').update({ is_suspended: true }).eq('id', userId)
              if (error) Alert.alert('Erreur', error.message)
              else { setIsSuspended(true); Alert.alert('Compte en pause ⏸', 'Ton profil est masqué. Reviens ici pour le réactiver.') }
            },
          },
        ]
      )
    }
  }

  // ── Account deletion ────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    router.push('/delete-account' as any)
  }

  // ── Re-fetch plan on mount (SDK 56 compatibility - no react-navigation) ──
  useEffect(() => {
    const refreshPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', session.user.id)
        .single()
      if (data?.subscription_plan) {
        const planMap: Record<string, 'FREE' | 'BUSINESS' | 'BUSINESS PRO'> = {
          free: 'FREE', business: 'BUSINESS', business_pro: 'BUSINESS PRO', pro: 'BUSINESS PRO',
        }
        setCurrentPlan(planMap[data.subscription_plan.toLowerCase()] || 'FREE')
      }
    }
    refreshPlan()
  }, [])

  // ── Start checkout (iOS uses In-App Purchase, others use Stripe) ─
  const handleUpgrade = async (plan: 'business' | 'business_pro') => {
    setCheckoutLoading(plan)
    try {
      // Get JWT
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        Alert.alert('Erreur', 'Tu dois être connecté pour souscrire.')
        return
      }

      // All platforms: Use Stripe Checkout (IAP disabled for MVP)
      console.log('[Settings] Using Stripe for non-iOS platform')
      const SUPABASE_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ plan }),
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data?.error || `Erreur serveur ${response.status}`
        Alert.alert('Erreur paiement', msg)
        return
      }

      if (!data?.url) {
        Alert.alert('Erreur paiement', data?.error || 'Aucune URL reçue')
        return
      }

      // Open Stripe checkout in browser
      await Linking.openURL(data.url)

    } catch (err: any) {
      Alert.alert('Erreur réseau', err?.message || 'Impossible de contacter le serveur.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.replace('/auth')
    } catch (err) {
      console.error('Sign out error:', err)
      alert('Erreur lors de la déconnexion')
    }
  }

  const plans = [
    {
      id: 'free',
      name: 'FREE',
      displayName: 'Gratuit',
      price: null,
      features: ['Swipes illimités', 'Likes illimités', 'Impossible de communiquer'],
    },
    {
      id: 'business',
      name: 'BUSINESS',
      displayName: 'Business',
      price: '5€',
      priceSubtext: '/mois',
      features: ['Swipes illimités', 'Likes illimités', 'Messages illimités', 'Encourage les membres Free'],
    },
    {
      id: 'business_pro',
      name: 'BUSINESS PRO',
      displayName: 'Business Pro',
      price: '10€',
      priceSubtext: '/mois',
      features: ['Tout Business inclus', 'Voir qui vous a liké', 'Retour en arrière (annuler un swipe)', 'Filtres avancés (âge + distance)', 'Accès prioritaire aux événements'],
    },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PAKT</Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {[
          { id: 'plans', label: 'Plans' },
          { id: 'events', label: 'Événements' },
          { id: 'news', label: 'Actus' },
          { id: 'referral', label: 'Parrainage' },
          { id: 'compte', label: 'Compte' },
          { id: 'legal', label: 'Mentions légales' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'plans' && (
          <View style={styles.plansContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {/* Current Plan Badge */}
                <View style={styles.currentPlanRow}>
                  <Text style={styles.currentPlanLabel}>Plan actuel: </Text>
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanText}>{currentPlan}</Text>
                  </View>
                </View>

                {/* Plans */}
                {plans.map((plan) => (
                  <View
                    key={plan.id}
                    style={styles.planCard}
                    ref={plan.id === 'business_pro' ? proCardRef : undefined}
                    onLayout={plan.id === 'business_pro' ? (e) => { proCardY.current = e.nativeEvent.layout.y } : undefined}
                  >
                    {/* Plan Header */}
                    <View style={styles.planHeader}>
                      <View>
                        <Text style={styles.planBadge}>{plan.name}</Text>
                        <Text style={styles.planTitle}>{plan.displayName}</Text>
                      </View>
                      {plan.price && (
                        <View style={styles.priceContainer}>
                          <Text style={styles.price}>{plan.price}</Text>
                          <Text style={styles.priceSubtext}>{plan.priceSubtext}</Text>
                        </View>
                      )}
                    </View>

                    {/* Features */}
                    <View style={styles.featuresList}>
                      {plan.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureItem}>
                          <Ionicons name="checkmark" size={16} color={colors.primary} style={styles.featureIcon} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Button */}
                    <TouchableOpacity
                      style={[
                        styles.planButton,
                        currentPlan === plan.name && styles.planButtonCurrent,
                        (checkoutLoading === plan.id || downgradingLoading) && styles.planButtonLoading,
                      ]}
                      onPress={() => {
                        if (currentPlan === plan.name) return
                        if (plan.id === 'free') {
                          handleDowngradeToFree()
                          return
                        }
                        handleUpgrade(plan.id as 'business' | 'business_pro')
                      }}
                      disabled={currentPlan === plan.name || !!(checkoutLoading) || !!downgradingLoading}
                    >
                      {(checkoutLoading === plan.id || downgradingLoading) ? (
                        <ActivityIndicator color={colors.bg.primary} size="small" />
                      ) : (
                        <Text
                          style={[
                            styles.planButtonText,
                            currentPlan === plan.name && styles.planButtonTextCurrent,
                          ]}
                        >
                          {currentPlan === plan.name
                            ? 'Plan actuel'
                            : plan.id === 'free'
                            ? 'Passer à Gratuit'
                            : `Passer ${plan.displayName}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Logout button removed from Plans — find it in Compte tab */}
              </>
            )}
          </View>
        )}

        {activeTab === 'events' && <ComingSoon icon="calendar-outline" title="Événements" subtitle="Les événements networking PAKT arrivent bientôt. Sois le premier informé." />}

        {activeTab === 'news' && (
          <View style={styles.newsContainer}>
            <Text style={styles.sectionHeader}>Actualités</Text>

            <TouchableOpacity
              style={styles.newsCard}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedNews({
                  id: 1,
                  title: 'Sortie officielle de PAKT',
                  date: '10 juin 2026',
                  category: 'Mise à jour majeure',
                  content: 'PAKT est officiellement lancé ! Rejoignez la communauté des entrepreneurs et talents pour collaborer, créer et grandir ensemble.',
                  fullContent: 'PAKT est officiellement lancé ! 🚀\n\nRejoignez la communauté des entrepreneurs et talents pour collaborer, créer et grandir ensemble.\n\nNouvelles fonctionnalités:\n• Découvrir les meilleurs profils business\n• Matcher avec des talents et entrepreneurs\n• Communiquer directement\n• Accéder au programme de parrainage\n\nBienvenue à bord!'
                })
                setShowNewsDetail(true)
              }}
            >
              <View style={styles.newsCardHeader}>
                <View style={styles.newsDateBadge}>
                  <Text style={styles.newsDate}>10 juin</Text>
                  <Text style={styles.newsYear}>2026</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.newsTitle}>Sortie officielle de PAKT</Text>
                  <Text style={styles.newsCategory}>Mise à jour majeure</Text>
                </View>
              </View>

              <Text style={styles.newsContent}>
                PAKT est officiellement lancé ! Rejoignez la communauté des entrepreneurs et talents pour collaborer, créer et grandir ensemble.
              </Text>

              <View style={styles.newsFooter}>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'referral' && (
          <View>
            <Text style={styles.sectionHeader}>Programme de Parrainage</Text>

            <View style={styles.referralCard}>
              <Ionicons name="gift" size={32} color={colors.primary} style={styles.referralIcon} />
              <Text style={styles.referralTitle}>Gagnez des récompenses</Text>
              <Text style={styles.referralText}>
                Invitez vos amis sur PAKT et recevez des avantages exclusifs
              </Text>
            </View>

            {/* Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Amis invités</Text>
                <Text style={styles.progressCount}>{referralCount} / 5</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(referralCount / 5) * 100}%` }
                  ]}
                />
              </View>
              <View style={styles.milestoneContainer}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <View
                    key={num}
                    style={[
                      styles.milestone,
                      referralCount >= num && styles.milestoneDone
                    ]}
                  >
                    <Text style={styles.milestoneText}>{num}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Paliers de récompense</Text>
              {[
                { count: 1, title: '1 ami invité', reward: '3 jours Business', days: '3J Business' },
                { count: 3, title: '3 amis invités', reward: '7 jours Business', days: '7J Business' },
                { count: 5, title: '5 amis invités', reward: '1 mois Business', days: '1M Business' },
                { count: 10, title: '10 amis invités', reward: '1 mois Business Pro', days: '1M Business Pro' },
              ].map((benefit) => {
                // Only FREE users can claim rewards (prevent downgrades for Business/Pro users)
                const canClaim = referralCount >= benefit.count && currentPlan === 'free'
                const claimedReward = activeRewards.find(r => r.days_granted === (benefit.days.includes('1M') ? 30 : benefit.days.includes('7') ? 7 : 3) && r.plan_granted === (benefit.days.includes('Pro') ? 'business_pro' : 'business'))
                const countdown = claimedReward ? rewardCountdowns[claimedReward.id] : null
                const isBusinessUser = currentPlan === 'business' || currentPlan === 'business_pro'

                return (
                  <View key={benefit.count} style={[styles.benefitItem, canClaim && styles.benefitItemUnlocked, claimedReward && { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: 'rgba(76, 175, 80, 0.3)' }]}>
                    <Ionicons name="star" size={20} color={claimedReward ? '#4caf50' : canClaim ? '#4caf50' : colors.primary} />
                    <View style={styles.benefitContent}>
                      <Text style={styles.benefitTitle}>{benefit.title}</Text>
                      <Text style={styles.benefitReward}>{benefit.reward}</Text>
                      {claimedReward && (
                        <Text style={{ color: '#4caf50', fontSize: 12, marginTop: 4 }}>✓ Expire dans {countdown || '...'}</Text>
                      )}
                      {isBusinessUser && !claimedReward && (
                        <Text style={{ color: '#ff9800', fontSize: 12, marginTop: 4 }}>Réservé aux plans Free</Text>
                      )}
                    </View>
                    {!claimedReward && canClaim && (
                      <TouchableOpacity
                        style={styles.claimButton}
                        onPress={() => handleClaimReward(benefit.count, benefit.days)}
                        disabled={claimingReward === benefit.count}
                      >
                        {claimingReward === benefit.count ? (
                          <ActivityIndicator color={colors.bg.primary} size="small" />
                        ) : (
                          <Text style={styles.claimButtonText}>Réclamer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
            </View>


            {/* Referral Code — tap to copy full message */}
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Ton code de parrainage</Text>
              <TouchableOpacity style={styles.codeBox} onPress={handleCopyReferral} activeOpacity={0.7}>
                <Text style={styles.codeText}>{referralCode || '...'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
                Appuie sur le code pour copier un message prêt à envoyer{'\n'}(SMS, WhatsApp, email...)
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'compte' && (
          <View>
            <Text style={styles.sectionHeader}>Informations du compte</Text>

            {/* Email Section */}
            <View style={styles.accountSection}>
              <Text style={styles.accountLabel}>Adresse email</Text>
              <Text style={styles.accountValue}>{userEmail || 'Non défini'}</Text>
            </View>


            {/* Change Password */}
            <TouchableOpacity style={styles.accountButton} onPress={handleChangePassword}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={styles.accountButtonText}>Modifier mon mot de passe</Text>
              <Ionicons name="chevron-forward" size={18} color="#ffffff44" />
            </TouchableOpacity>

            {/* Suspend/Reactivate Account */}
            <TouchableOpacity style={isSuspended ? styles.accountButtonSuccess : styles.accountButtonWarning} onPress={handleSuspendAccount}>
              <Ionicons name={isSuspended ? 'play-outline' : 'pause-outline'} size={18} color={isSuspended ? '#4caf50' : '#ff9800'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.accountButtonText}>
                  {isSuspended ? 'Réactiver mon compte' : 'Mettre en pause'}
                </Text>
                <Text style={styles.accountButtonSubtext}>
                  {isSuspended ? '⏸ Ton profil est actuellement masqué' : 'Ton profil ne sera plus visible par les autres'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ffffff44" />
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity style={styles.accountButtonDanger} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={18} color="#ff4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountButtonText, { color: '#ff4444' }]}>Supprimer mon compte</Text>
                <Text style={[styles.accountButtonSubtext, { color: '#ff444488' }]}>Action définitive et irréversible</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ffffff44" />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutButtonAlt}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.text.primary} />
              <Text style={styles.logoutButtonTextAlt}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'legal' && (
          <View>
            <Text style={styles.sectionHeader}>Mentions légales</Text>
            {LEGAL_SECTIONS.map((section) => (
              <TouchableOpacity
                key={section.id}
                style={styles.legalItem}
                onPress={() => setSelectedLegal(section.id)}
              >
                <Text style={styles.legalTitle}>{section.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#ffffff44" />
              </TouchableOpacity>
            ))}

            {/* Support Email */}
            <View style={styles.supportSection}>
              <Text style={styles.supportLabel}>Support</Text>
              <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
            </View>

            {/* Footer */}
            <View style={styles.footerInfo}>
              <Text style={styles.footerText}>PAKT © 2026</Text>
              <Text style={styles.footerText}>Version 1.0.0</Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Legal Modal */}
      <Modal visible={selectedLegal !== null} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header with back button */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedLegal(null)} hitSlop={8}>
              <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {LEGAL_SECTIONS.find(s => s.id === selectedLegal)?.label || ''}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Modal Content with padding */}
          <ScrollView style={styles.modalContent}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Text style={styles.modalText}>
                {selectedLegal && LEGAL_CONTENT[selectedLegal as keyof typeof LEGAL_CONTENT]?.content}
              </Text>
              <View style={{ height: 40 }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* News Detail Modal */}
      <Modal visible={showNewsDetail} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedNews?.title || ''}</Text>
            <TouchableOpacity onPress={() => setShowNewsDetail(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent}>
            <View style={styles.newsDetailDateBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={styles.newsDetailDate}>{selectedNews?.date}</Text>
            </View>
            <Text style={styles.newsDetailCategory}>{selectedNews?.category}</Text>
            <Text style={styles.newsDetailText}>{selectedNews?.fullContent}</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },

  tabsContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },

  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 20 },

  plansContainer: {},
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  currentPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentPlanLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  currentPlanBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  currentPlanText: {
    color: colors.bg.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  planCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planBadge: {
    backgroundColor: `${colors.primary}33`,
    color: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  planTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceSubtext: {
    color: colors.text.tertiary,
    fontSize: 12,
  },

  featuresList: {
    gap: 8,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    marginRight: 4,
  },
  featureText: {
    color: '#ffffff99',
    fontSize: 13,
    flex: 1,
  },

  planButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  planButtonCurrent: {
    backgroundColor: '#4a4a4a',
    borderWidth: 1,
    borderColor: '#666',
  },
  planButtonLoading: {
    opacity: 0.7,
  },
  planButtonText: {
    color: colors.bg.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  planButtonTextCurrent: {
    color: colors.text.primary,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#8b0000',
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  logoutButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  sectionHeader: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  eventCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
    flexDirection: 'row',
    gap: 12,
  },
  eventDateBadge: {
    backgroundColor: `${colors.primary}33`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  eventDate: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  eventLocation: {
    color: colors.primary,
    fontSize: 12,
  },
  eventDescription: {
    color: colors.text.secondary,
    fontSize: 12,
  },

  newsCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
  },
  newsDate: {
    color: colors.text.tertiary,
    fontSize: 11,
    marginBottom: 6,
  },
  newsTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  newsDescription: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },

  referralCard: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
    alignItems: 'center',
  },
  referralIcon: {
    marginBottom: 12,
  },
  referralTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  referralText: {
    color: colors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
  },

  benefitsContainer: {
    marginBottom: 16,
  },
  benefitsTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
  },
  benefitItemClaimed: {
    backgroundColor: '#4caf5015',
    borderColor: '#4caf5044',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitReward: {
    color: colors.primary,
    fontSize: 12,
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  claimButtonText: {
    color: colors.bg.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  benefitItemUnlocked: {
    backgroundColor: '#4caf5015',
    borderColor: '#4caf5044',
  },
  benefitRewardClaimed: {
    color: '#4caf50',
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  claimButtonText: {
    color: colors.bg.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  claimedBadge: {
    backgroundColor: '#4caf50',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationBox: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  explanationText: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },

  referralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 10,
  },
  referralButtonText: {
    color: colors.bg.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  /* Account Tab */
  accountSection: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
  },
  accountLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  accountValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
    gap: 12,
  },
  accountButtonSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf5015',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4caf5044',
    gap: 12,
  },
  accountButtonWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff980015',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ff980044',
    gap: 12,
  },
  accountButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff444415',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ff444444',
    gap: 12,
  },
  accountButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  accountButtonSubtext: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 4,
  },

  logoutButtonAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.quaternary,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  logoutButtonTextAlt: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.bg.quaternary,
  },
  legalTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  supportSection: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  supportLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  supportEmail: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  footerInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.bg.tertiary,
  },
  footerText: {
    color: '#ffffff44',
    fontSize: 11,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.tertiary,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
  },

  // Referral Progress Styles
  progressSection: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressCount: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  milestoneContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  milestoneDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  milestoneText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Code Section Styles
  codeSection: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  codeLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  codeText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },

  // News Tab
  newsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  newsCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    ...shadows.sm,
  },
  newsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  newsDateBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
  },
  newsDate: {
    color: colors.bg.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  newsYear: {
    color: colors.bg.primary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  newsTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: spacing.xs,
  },
  newsCategory: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  newsContent: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  // News Detail Modal
  newsDetailDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  newsDetailDate: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  newsDetailCategory: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  newsDetailText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 26,
    letterSpacing: 0.2,
  },
})
