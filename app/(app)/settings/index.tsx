import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Linking, ToastAndroid, Platform, TextInput } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '@/lib/supabase/client'
import { LEGAL_SECTIONS, SUPPORT_EMAIL, LEGAL_CONTENT } from '@/lib/constants/legal-content'

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
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212,168,83,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4a853',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(212,168,83,0.4)',
  },
})

export default function SettingsPage() {
  const router = useRouter()
  const { scroll } = useLocalSearchParams<{ scroll?: string }>()
  const scrollViewRef = useRef<ScrollView>(null)
  const proCardRef = useRef<View>(null)
  const proCardY = useRef<number>(0)

  const [activeTab, setActiveTab] = useState<'plans' | 'events' | 'news' | 'referral' | 'legal' | 'compte'>('plans')
  const [currentPlan, setCurrentPlan] = useState<'FREE' | 'BUSINESS' | 'BUSINESS PRO'>('FREE')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState('')
  const [referralLoading, setReferralLoading] = useState(false)
  const [selectedLegal, setSelectedLegal] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const [referralLink, setReferralLink] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeUsed, setCodeUsed] = useState(false)

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
          .select('subscription_plan')
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
          setCurrentPlan(planMap[data.subscription_plan?.toLowerCase()] || 'FREE')
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

  // ── Use a referral code ──────────────────────────────────────────────────────
  const handleUseCode = async () => {
    if (!inputCode.trim()) return
    setCodeLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
      const res = await fetch(`${SUPA_URL}/functions/v1/use-referral-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ code: inputCode.trim() }),
      })
      const data = await res.json()
      if (!data.success) Alert.alert('Erreur', data.error || 'Code invalide.')
      else {
        Alert.alert('Code appliqué ✅', 'Le code de parrainage a bien été enregistré !')
        setCodeUsed(true)
        setInputCode('')
      }
    } catch { Alert.alert('Erreur réseau', 'Impossible de contacter le serveur.') }
    finally { setCodeLoading(false) }
  }

  const handleCopyReferral = async () => {
    try {
      // Simple message with just the code — mobile app, no web links
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
    Alert.alert(
      'Suspendre mon compte',
      'Ton profil ne sera plus visible par les autres membres. Tu pourras le réactiver à tout moment depuis les paramètres.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Suspendre',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return
            const { error } = await supabase.from('profiles').update({ is_suspended: true }).eq('id', userId)
            if (error) Alert.alert('Erreur', error.message)
            else Alert.alert('Compte suspendu', 'Ton profil est maintenant masqué. Reviens dans Paramètres > Compte pour le réactiver.')
          },
        },
      ]
    )
  }

  // ── Account deletion ────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    router.push('/delete-account' as any)
  }

  // ── Re-fetch plan when screen comes into focus (after returning from payment) ──
  useFocusEffect(
    useCallback(() => {
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
  )

  // ── Start checkout (direct fetch - more reliable than supabase.functions.invoke) ─
  const handleUpgrade = async (plan: 'business' | 'business_pro') => {
    setCheckoutLoading(plan)
    try {
      // Get JWT
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        Alert.alert('Erreur', 'Tu dois être connecté pour souscrire.')
        return
      }

      // Direct fetch to Edge Function - bypasses Supabase JS client issues
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
                <ActivityIndicator size="large" color="#ffd700" />
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
                          <Ionicons name="checkmark" size={16} color="#ffd700" style={styles.featureIcon} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Button */}
                    <TouchableOpacity
                      style={[
                        styles.planButton,
                        currentPlan === plan.name && styles.planButtonCurrent,
                        checkoutLoading === plan.id && styles.planButtonLoading,
                      ]}
                      onPress={() => {
                        if (currentPlan === plan.name) return
                        if (plan.id === 'free') return
                        handleUpgrade(plan.id as 'business' | 'business_pro')
                      }}
                      disabled={currentPlan === plan.name || plan.id === 'free' || !!checkoutLoading}
                    >
                      {checkoutLoading === plan.id ? (
                        <ActivityIndicator color="#000" size="small" />
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
                            ? 'Gratuit'
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

        {activeTab === 'news' && <ComingSoon icon="newspaper-outline" title="Actualités" subtitle="Les dernières nouvelles de PAKT seront disponibles ici très prochainement." />}

        {activeTab === 'referral' && (
          <View>
            <Text style={styles.sectionHeader}>Programme de Parrainage</Text>

            <View style={styles.referralCard}>
              <Ionicons name="gift" size={32} color="#ffd700" style={styles.referralIcon} />
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
              <Text style={styles.benefitsTitle}>Vos récompenses</Text>
              {[
                { title: '1 ami invité', reward: '1 mois Business offert', icon: 'star' },
                { title: '3 amis invités', reward: '3 mois Business Pro offert', icon: 'star-half' },
                { title: '5 amis invités', reward: 'Accès VIP + support prioritaire', icon: 'sparkles' },
              ].map((benefit, idx) => (
                <View key={idx} style={styles.benefitItem}>
                  <Ionicons name={benefit.icon as any} size={20} color="#ffd700" />
                  <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitReward}>{benefit.reward}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Enter a friend's referral code */}
            {!codeUsed && (
              <View style={[styles.codeSection, { marginBottom: 16 }]}>
                <Text style={styles.codeLabel}>Tu as un code d'un ami ?</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.codeBox, { flex: 1, color: '#fff', fontSize: 13 }]}
                    placeholder="Entre le code ici (ex: REF-XXXXXXX)"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={inputCode}
                    onChangeText={t => setInputCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleUseCode}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#d4a853', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', opacity: codeLoading ? 0.6 : 1 }}
                    onPress={handleUseCode}
                    disabled={codeLoading}
                  >
                    {codeLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>OK</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Referral Code — tap to copy full message */}
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Ton code de parrainage</Text>
              <TouchableOpacity style={styles.codeBox} onPress={handleCopyReferral} activeOpacity={0.7}>
                <Text style={styles.codeText}>{referralCode || '...'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="copy-outline" size={20} color="#ffd700" />
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
              <Ionicons name="lock-closed-outline" size={18} color="#ffd700" />
              <Text style={styles.accountButtonText}>Modifier mon mot de passe</Text>
              <Ionicons name="chevron-forward" size={18} color="#ffffff44" />
            </TouchableOpacity>

            {/* Suspend Account */}
            <TouchableOpacity style={styles.accountButtonWarning} onPress={handleSuspendAccount}>
              <Ionicons name="pause-outline" size={18} color="#ff9800" />
              <View style={{ flex: 1 }}>
                <Text style={styles.accountButtonText}>Suspendre mon compte</Text>
                <Text style={styles.accountButtonSubtext}>Ton profil ne sera plus visible par les autres membres</Text>
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
              <Ionicons name="log-out-outline" size={18} color="#fff" />
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
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {LEGAL_SECTIONS.find(s => s.id === selectedLegal)?.label || ''}
            </Text>
            <TouchableOpacity onPress={() => setSelectedLegal(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              {selectedLegal && LEGAL_CONTENT[selectedLegal as keyof typeof LEGAL_CONTENT]?.content}
            </Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#ffd700',
    fontSize: 32,
    fontWeight: 'bold',
  },

  tabsContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    borderBottomColor: '#ffd700',
  },
  tabText: {
    color: '#ffffff66',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffd700',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  currentPlanBadge: {
    backgroundColor: '#ffd700',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  currentPlanText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },

  planCard: {
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#ffd70033',
    color: '#ffd700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  planTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceSubtext: {
    color: '#ffffff66',
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
    backgroundColor: '#ffd700',
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
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  planButtonTextCurrent: {
    color: '#fff',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  sectionHeader: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    gap: 12,
  },
  eventDateBadge: {
    backgroundColor: '#ffd70033',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  eventDate: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '700',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    color: '#fff',
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
    color: '#ffd700',
    fontSize: 12,
  },
  eventDescription: {
    color: '#ffffff88',
    fontSize: 12,
  },

  newsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  newsDate: {
    color: '#ffffff66',
    fontSize: 11,
    marginBottom: 6,
  },
  newsTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  newsDescription: {
    color: '#ffffff88',
    fontSize: 13,
    lineHeight: 18,
  },

  referralCard: {
    backgroundColor: '#ffd70015',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd70044',
    alignItems: 'center',
  },
  referralIcon: {
    marginBottom: 12,
  },
  referralTitle: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  referralText: {
    color: '#ffffff88',
    fontSize: 13,
    textAlign: 'center',
  },

  benefitsContainer: {
    marginBottom: 16,
  },
  benefitsTitle: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitReward: {
    color: '#ffd700',
    fontSize: 12,
  },

  referralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd700',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 10,
  },
  referralButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Account Tab */
  accountSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  accountLabel: {
    color: '#ffffff66',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  accountValue: {
    color: '#ffd700',
    fontSize: 15,
    fontWeight: '600',
  },

  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  accountButtonSubtext: {
    color: '#ffffff66',
    fontSize: 12,
    marginTop: 4,
  },

  logoutButtonAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  logoutButtonTextAlt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  legalTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  supportSection: {
    backgroundColor: '#ffd70015',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd70044',
  },
  supportLabel: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  supportEmail: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  footerInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  footerText: {
    color: '#ffffff44',
    fontSize: 11,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalText: {
    color: '#ffffff88',
    fontSize: 13,
    lineHeight: 20,
  },

  // Referral Progress Styles
  progressSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd70044',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    color: '#ffd700',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressCount: {
    color: '#fff',
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
    backgroundColor: '#ffd700',
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
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  milestoneText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Code Section Styles
  codeSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffd70044',
  },
  codeLabel: {
    color: '#ffd700',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
})
