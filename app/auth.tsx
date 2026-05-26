import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, SafeAreaView, Alert, Modal } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [showCGU, setShowCGU] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace('/(app)/swipe')
        }
        setLoading(false)
      } catch (err) {
        console.error('[AUTH] Session check error:', err)
        setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          router.replace('/(app)/swipe')
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
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        Alert.alert('Succès', 'Compte créé ! Vérifie ton email pour confirmer')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      console.error('[AUTH] Email auth error:', err)
      Alert.alert('Erreur', err?.message || 'Une erreur est survenue')
    } finally {
      setSigningIn(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    setSigningIn(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:8081/auth',
          skipBrowserRedirect: false,
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error('[AUTH] Google OAuth error:', err)
      Alert.alert('Erreur Google', err?.message || 'La connexion Google a échoué')
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
        </View>

        {/* Separator */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ou</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Google Button - Official Google Design */}
        <TouchableOpacity
          style={[styles.googleButton, signingIn && styles.buttonDisabled]}
          onPress={handleSignInWithGoogle}
          disabled={signingIn}
        >
          <GoogleIcon />
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

// Official Google Icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 4 }}>
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"
      />
      <path
        fill="#EA4335"
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"
      />
    </svg>
  )
}
