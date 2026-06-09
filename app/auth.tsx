import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, SafeAreaView, Alert, Modal, Image, Animated, KeyboardAvoidingView, Platform } from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { colors, spacing, borderRadius, shadows, typography, transitions } from '@/lib/theme'

WebBrowser.maybeCompleteAuthSession()

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [showCGU, setShowCGU] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: transitions.normal,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: transitions.normal,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, slideAnim])

  const redirectAfterAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', session.user.id)
        .single()
      if (profileError) {
        router.replace('/onboarding')
        return
      }
      if (profile?.is_onboarded) {
        router.replace('/(app)/swipe')
      } else {
        router.replace('/onboarding')
      }
    } catch (err) {
      router.replace('/onboarding')
    }
  }

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await redirectAfterAuth()
        }
        setLoading(false)
      } catch (err) {
        setLoading(false)
      }
    }
    checkSession()
  }, [router])

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Email et mot de passe requis')
      return
    }
    setSigningIn(true)
    try {
      if (mode === 'signup') {
        const { data, error: funcError } = await supabase.functions.invoke('request-email-confirmation', { body: { email, password } })
        if (funcError) throw new Error(funcError?.message || 'Erreur lors de la création du compte')
        if (!data?.success) throw new Error(data?.error || 'Erreur lors de l\'inscription')
        Alert.alert('Compte créé ! ✅', 'Un email de confirmation t\'a été envoyé. Clique sur le lien pour confirmer ton adresse, puis connecte-toi.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Une erreur est survenue.')
    } finally {
      setSigningIn(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email requis', 'Entre ton adresse email pour réinitialiser ton mot de passe.')
      return
    }
    try {
      setSigningIn(true)
      const SUPA_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'
      const res = await fetch(`${SUPA_URL}/functions/v1/reset-password-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      Alert.alert('Email envoyé ✅', `Un lien de réinitialisation a été envoyé à ${email}. Ouvre-le depuis ton téléphone.`)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'email. Vérifie ton adresse.')
    } finally {
      setSigningIn(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true)
      const redirectTo = Linking.createURL('auth/callback')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No OAuth URL')

      // openAuthSessionAsync intercepts the deep link and returns the URL directly
      // → Linking listener in _layout.tsx never fires, we must handle it here
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success') {
        const url = result.url
        // Implicit flow: tokens are in the hash fragment
        // pakt://auth/callback#access_token=...&refresh_token=...
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || ''
        const params = new URLSearchParams(fragment)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
          // onAuthStateChange in _layout.tsx will handle the redirect to swipe/onboarding
        } else {
          throw new Error('Tokens manquants dans la réponse OAuth')
        }
      }
      // result.type === 'cancel' or 'dismiss' → user closed, do nothing
    } catch (err: any) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('dismiss')) {
        Alert.alert('Erreur Google', err?.message || 'Impossible de se connecter avec Google')
      }
    } finally {
      setSigningIn(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.logo}>PAKT</Text>
              <Text style={styles.tagline}>Le Tinder du business</Text>
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              {(['login', 'signup'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeButton, mode === m && styles.modeButtonActive]}
                  onPress={() => setMode(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                    {m === 'login' ? 'Connexion' : 'Inscription'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form */}
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.text.tertiary}
                value={email}
                onChangeText={setEmail}
                editable={!signingIn}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!signingIn}
              />
              <TouchableOpacity
                style={[styles.primaryButton, signingIn && styles.buttonDisabled]}
                onPress={handleEmailAuth}
                disabled={signingIn}
                activeOpacity={0.9}
              >
                {signingIn ? (
                  <ActivityIndicator color={colors.bg.primary} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                  </Text>
                )}
              </TouchableOpacity>

              {mode === 'login' && (
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Separator */}
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Google Button */}
            <TouchableOpacity
              style={[styles.googleButton, signingIn && { opacity: 0.6 }]}
              onPress={handleGoogleSignIn}
              disabled={signingIn}
              activeOpacity={0.8}
            >
              <Image source={require('../assets/google-logo.png')} style={{ width: 20, height: 20 }} />
              <Text style={styles.googleButtonText}>Continuer avec Google</Text>
            </TouchableOpacity>

            {/* Disclaimer */}
            <View style={styles.disclaimerContainer}>
              <Text style={styles.disclaimer}>
                En continuant, tu acceptes nos{' '}
                <Text style={[styles.disclaimerLink, styles.clickable]} onPress={() => setShowCGU(true)}>
                  CGU
                </Text>
                {' '}et notre{' '}
                <Text style={[styles.disclaimerLink, styles.clickable]} onPress={() => setShowPrivacy(true)}>
                  Politique de confidentialité
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <Modal visible={showCGU} transparent animationType="fade" onRequestClose={() => setShowCGU(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>CGU</Text>
            <TouchableOpacity onPress={() => setShowCGU(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalText}>Conditions Générales d'Utilisation...</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showPrivacy} transparent animationType="fade" onRequestClose={() => setShowPrivacy(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Politique de confidentialité</Text>
            <TouchableOpacity onPress={() => setShowPrivacy(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalText}>Politique de confidentialité...</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logo: {
    color: colors.primary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: spacing.md,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  tagline: {
    color: colors.text.secondary,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xxxl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  modeButtonText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeButtonTextActive: {
    color: colors.bg.primary,
    fontWeight: '700',
  },

  // Form
  form: {
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  input: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Primary Button
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.glow,
  },
  primaryButtonText: {
    color: colors.bg.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Forgot Password
  forgotPassword: {
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxxl,
    gap: spacing.lg,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.secondary,
  },
  separatorText: {
    color: colors.text.tertiary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.glow,
  },
  googleButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Disclaimer
  disclaimerContainer: {
    marginTop: spacing.xxxl,
    paddingHorizontal: spacing.sm,
  },
  disclaimer: {
    color: colors.text.quaternary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.3,
    fontWeight: '400',
  },
  disclaimerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  clickable: {
    opacity: 0.9,
  },

  // Buttons State
  buttonDisabled: {
    opacity: 0.6,
  },

  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  modalText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
})
