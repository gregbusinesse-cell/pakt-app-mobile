import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
import { Ionicons } from '@expo/vector-icons'

export default function ConfirmEmailPage() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const confirmEmail = async () => {
      if (!token) {
        setError('Token manquant')
        setLoading(false)
        return
      }

      try {
        console.log('[CONFIRM] Verifying token:', token)

        const { data, error: funcError } = await supabase.functions.invoke(
          'verify-email-confirmation',
          { body: { token } }
        )

        if (funcError) {
          console.error('[CONFIRM] Verification error:', funcError)
          setError(funcError?.message || 'Erreur de vérification')
        } else if (data?.success) {
          console.log('[CONFIRM] Email verified successfully')
          setVerified(true)
          // Auto-redirect to login after 2 seconds
          setTimeout(() => {
            router.replace('/auth')
          }, 2000)
        } else {
          setError(data?.error || 'Impossible de vérifier l\'email')
        }
      } catch (err) {
        console.error('[CONFIRM] Error:', err)
        setError('Une erreur est survenue')
      } finally {
        setLoading(false)
      }
    }

    confirmEmail()
  }, [token])

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#d4a853" />
        <Text style={styles.loadingText}>Vérification de ton email...</Text>
      </View>
    )
  }

  if (verified) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={80} color="#d4a853" style={styles.icon} />
        <Text style={styles.title}>Email confirmé!</Text>
        <Text style={styles.message}>
          Ton adresse email a été confirmée avec succès. Tu peux maintenant te connecter.
        </Text>
        <Text style={styles.redirectText}>Redirection vers la connexion...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={80} color="#ff4444" style={styles.icon} />
      <Text style={styles.errorTitle}>Erreur</Text>
      <Text style={styles.errorMessage}>{error || 'Token invalide ou expiré'}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/auth')}
      >
        <Text style={styles.buttonText}>Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
  },
  redirectText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 24,
  },
  button: {
    backgroundColor: '#d4a853',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
})
