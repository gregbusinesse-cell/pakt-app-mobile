import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'

export default function PaymentSuccessPage() {
  const router = useRouter()
  const { plan, session_id } = useLocalSearchParams<{ plan: string; session_id: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const confirm = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setStatus('error')
          return
        }

        // Confirm payment with Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('confirm-payment', {
          body: { session_id, plan },
        })

        if (error || !data?.success) {
          console.error('[PAYMENT] Confirm error:', error, data)
          // Even if confirm fails, the webhook will handle it
          // Still redirect to settings after a short delay
        }

        setStatus('success')

        // Redirect to settings after 2 seconds
        setTimeout(() => {
          router.replace('/(app)/settings' as any)
        }, 2000)

      } catch (err) {
        console.error('[PAYMENT] Error:', err)
        setStatus('error')
        setTimeout(() => router.replace('/(app)/settings' as any), 3000)
      }
    }

    confirm()
  }, [session_id, plan])

  const planLabel = plan === 'business_pro' ? 'Business Pro' : 'Business'

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#d4a853" />
        <Text style={styles.loadingText}>Activation de ton plan...</Text>
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={64} color="#ff4444" />
        <Text style={styles.errorTitle}>Vérification en cours</Text>
        <Text style={styles.errorText}>
          Ton paiement est enregistré. Ton plan sera activé dans quelques instants.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={48} color="#0a0a0a" />
      </View>
      <Text style={styles.title}>Paiement confirmé!</Text>
      <Text style={styles.subtitle}>
        Bienvenue dans PAKT {planLabel}
      </Text>
      <Text style={styles.redirectText}>Redirection vers ton profil...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d4a853',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#d4a853',
    fontWeight: '600',
    textAlign: 'center',
  },
  redirectText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
})
