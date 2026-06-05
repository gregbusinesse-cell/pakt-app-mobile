import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, SafeAreaView, Alert, Modal, Image } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

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

  // Google Auth - TEMPORARILY DISABLED (no native modules in APK)
  // TODO: Re-enable after proper dev build with native modules
  // const [request, response, promptAsync] = Google.useAuthRequest({
  //   clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  //   redirectUrl: AuthSession.getRedirectUrl(),
  // })

  // Handle Google response - DISABLED
  // useEffect(() => {
  //   if (response?.type === 'success') {
  //     const { id_token } = response.params
  //     if (id_token) {
  //       signInWithGoogle(id_token)
  //     }
  //   }
  // }, [response])


  // Helper function to check onboarding status and redirect
  const redirectAfterAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Fetch profile to check onboarding status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        console.warn('[AUTH] Profile fetch error:', profileError)
        // If profile not found, send to onboarding
        router.replace('/onboarding')
        return
      }

      // Check if user completed onboarding
      if (profile?.is_onboarded) {
        router.replace('/(app)/swipe')
      } else {
        router.replace('/onboarding')
      }
    } catch (err) {
      console.error('[AUTH] Redirect error:', err)
      // Default to onboarding on error
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
        console.error('[AUTH] Session check error:', err)
        setLoading(false)
      }
    }

    checkSession()

    // IMPORTANT: utilise session directement (pas getSession()) pour éviter le deadlock
    // setSession() tient le lock interne → notifie onAuthStateChange →
    // getSession() essaie d'acquérir le même lock → DEADLOCK
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.id) {
          // Utilise session.user.id directement — aucun appel getSession()
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_onboarded')
            .eq('id', session.user.id)
            .single()

          if (profile?.is_onboarded) {
            router.replace('/(app)/swipe' as any)
          } else {
            router.replace('/onboarding' as any)
          }
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [router])

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Email et mot de passe requis')
      return
    }

    setSigningIn(true)
    try {
      if (mode === 'signup') {
        // Use supabase.functions.invoke — handles auth headers automatically
        const { data, error: funcError } = await supabase.functions.invoke(
          'request-email-confirmation',
          { body: { email, password } }
        )

        console.log('[AUTH] Signup response:', JSON.stringify(data), 'error:', funcError?.message)

        if (funcError) {
          console.error('[AUTH] Signup function error:', funcError)
          throw new Error(funcError?.message || 'Erreur lors de la création du compte')
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erreur lors de l\'inscription')
        }

        Alert.alert(
          'Compte créé ! ✅',
          'Un email de confirmation t\'a été envoyé. Clique sur le lien pour confirmer ton adresse, puis connecte-toi.'
        )
      } else {
        // Login mode
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      console.error('[AUTH] Email auth error:', err)
      const raw = err?.message || ''
      const msg = raw.includes('Invalid login credentials') || raw.includes('invalid_credentials')
        ? 'Email ou mot de passe incorrect.'
        : raw.includes('already registered') || raw.includes('already been registered')
        ? 'Un compte existe déjà avec cet email. Connecte-toi.'
        : raw.includes('Email not confirmed')
        ? 'Confirme ton adresse email avant de te connecter.'
        : raw.includes('password') && raw.includes('short')
        ? 'Mot de passe trop court (6 caractères minimum).'
        : raw || 'Une erreur est survenue.'
      Alert.alert('Erreur', msg)
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
      // Get a temp session to call the reset function
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

      // openBrowserAsync ouvre le browser SANS intercepter le deep link de retour
      // → Expo Router reçoit seul le deep link → auth/callback.tsx gère tout
      await WebBrowser.openBrowserAsync(data.url)
      // Le browser est fermé (deep link reçu ou annulation)
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
        <ActivityIndicator size="large" color="#ffd700" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>PAKT</Text>
          <Text style={styles.tagline}>Le Tinder du Business</Text>
        </View>

        {/* Mode Toggle (Login / Signup) */}
        <View style={styles.modeToggle}>
          {(['login', 'signup'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email & Password Inputs */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#ffffff66"
            value={email}
            onChangeText={setEmail}
            editable={!signingIn}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#ffffff66"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!signingIn}
          />

          <TouchableOpacity
            style={[styles.primaryButton, signingIn && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Forgot password */}
          {mode === 'login' && (
            <TouchableOpacity onPress={handleForgotPassword} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: '#d4a853', fontSize: 13 }}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Separator */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ou</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Google Button with official Google logo */}
        <TouchableOpacity
          style={[styles.googleButton, signingIn && { opacity: 0.6 }]}
          onPress={handleGoogleSignIn}
          disabled={signingIn}
        >
          <Image
            source={require('../assets/google-logo.png')}
            style={{ width: 22, height: 22 }}
          />
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
      </ScrollView>

      {/* CGU Modal */}
      <Modal
        visible={showCGU}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCGU(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conditions Générales d'Utilisation</Text>
            <TouchableOpacity onPress={() => setShowCGU(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalText}>
              Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») encadrent l'accès et l'utilisation de l'application PAKT, éditée par Velura, micro-entreprise immatriculée sous le SIRET 925 272 957 00018, dont le siège social est situé 229 rue Saint-Honoré, 75001 Paris, France.{'\n\n'}

              La création d'un compte et l'utilisation de l'application valent acceptation pleine, entière et sans réserve des présentes CGU. À défaut d'acceptation, l'utilisateur doit s'abstenir d'utiliser le service.{'\n\n'}

              PAKT est une application de networking et d'accompagnement entrepreneurial permettant aux utilisateurs de découvrir d'autres profils, échanger via messages privés, créer ou rejoindre des projets, participer à des événements, accéder à des ressources et bénéficier de fonctionnalités premium par abonnement.{'\n\n'}

              L'utilisateur s'engage à fournir des informations exactes, complètes, à jour et sincères lors de la création de son compte. L'utilisateur ne peut détenir qu'un seul compte actif.{'\n\n'}

              L'utilisateur est seul responsable de la confidentialité de ses identifiants (email, mot de passe, comptes tiers liés tels que Google) et de toutes les actions effectuées depuis son compte.{'\n\n'}

              L'utilisateur s'interdit de créer un faux profil, usurper l'identité d'un tiers, publier des contenus illégaux, harceler, diffuser du spam, ou tenter de contourner les mesures de sécurité.{'\n\n'}

              PAKT facilite la découverte et la mise en relation entre utilisateurs mais ne garantit en aucune façon l'identité réelle, l'âge, les compétences ou la fiabilité des utilisateurs.{'\n\n'}

              L'utilisateur peut supprimer son compte à tout moment, gratuitement, depuis les paramètres de l'application. La suppression entraîne l'effacement définitif de l'ensemble des données.{'\n\n'}

              Pour plus de détails, consultez les conditions complètes directement depuis l'application.{'\n\n'}

              Dernière mise à jour : 18 mai 2025
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacy}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacy(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Politique de Confidentialité</Text>
            <TouchableOpacity onPress={() => setShowPrivacy(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalText}>
              La présente politique de confidentialité décrit comment Velura, exploitant l'application PAKT, collecte, utilise, conserve et protège les données personnelles de ses utilisateurs, conformément au Règlement (UE) 2016/679 (RGPD) et à la Loi Informatique et Libertés.{'\n\n'}

              RESPONSABLE DU TRAITEMENT{'\n'}
              Velura, micro-entreprise exploitant la marque PAKT{'\n'}
              Siège : 229 rue Saint-Honoré, 75001 Paris, France{'\n'}
              SIRET : 925 272 957 00018{'\n'}
              Email : paktsupport@gmail.com{'\n\n'}

              DONNÉES COLLECTÉES{'\n'}
              • Données d'identification : nom, prénom, email, mot de passe haché, date de naissance{'\n'}
              • Données de profil : photo, biographie, ville, entreprise, secteur, centres d'intérêt, compétences{'\n'}
              • Contenus publiés : messages, fichiers, photos téléversées{'\n'}
              • Données d'usage : profils consultés, likes, matchs, dates de connexion{'\n'}
              • Données techniques : adresse IP, identifiant d'appareil, logs de connexion{'\n\n'}

              PAKT ne collecte ni ne stocke de géolocalisation GPS précise, ni aucune donnée sensible au sens du RGPD.{'\n\n'}

              FINALITÉS DU TRAITEMENT{'\n'}
              Les données sont traitées pour : créer et authentifier le compte, permettre la mise en relation, gérer les abonnements, envoyer des notifications, modérer la plateforme, améliorer le service et respecter les obligations légales.{'\n\n'}

              SÉCURITÉ{'\n'}
              Velura met en œuvre des mesures techniques appropriées : chiffrement HTTPS/TLS, hachage des mots de passe, authentification renforcée, contrôle d'accès et journalisation.{'\n\n'}

              SUPPRESSION DU COMPTE{'\n'}
              L'utilisateur peut supprimer son compte gratuitement. La suppression entraîne l'effacement définitif des données dans un délai maximal de 48 heures, sous réserve des obligations légales de conservation.{'\n\n'}

              DROITS{'\n'}
              Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition. Pour exercer ces droits : paktsupport@gmail.com{'\n\n'}

              Dernière mise à jour : 18 mai 2025
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    color: '#ffd700',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 4,
  },
  tagline: {
    color: '#ffffff66',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ffd700',
  },
  modeButtonText: {
    color: '#ffffff80',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#000',
  },

  // Form
  form: {
    gap: 12,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  primaryButton: {
    backgroundColor: '#ffd700',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  separatorText: {
    color: '#ffffff50',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Modals
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
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalText: {
    color: '#ffffffcc',
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.3,
  },

  // Disclaimer
  disclaimerContainer: {
    marginBottom: 12,
  },
  disclaimer: {
    color: '#ffffff66',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  disclaimerLink: {
    color: '#ffd700',
    textDecorationLine: 'underline',
  },
  clickable: {
    opacity: 0.8,
  },

  // Disabled state
  buttonDisabled: {
    opacity: 0.6,
  },
})

// // Google Icon - DISABLED FOR TESTING
// function GoogleIcon() {
//   return (
//     <View style={{ width: 20, height: 20, position: 'relative' }}>
//       {/* Blue square */}
//       <View style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, backgroundColor: '#4285F4', borderRadius: 2 }} />
//       {/* Red square */}
//       <View style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, backgroundColor: '#EA4335', borderRadius: 2 }} />
//       {/* Yellow square */}
//       <View style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, backgroundColor: '#FBBC04', borderRadius: 2 }} />
//       {/* Green square */}
//       <View style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#34A853', borderRadius: 2 }} />
//     </View>
//   )
// }
