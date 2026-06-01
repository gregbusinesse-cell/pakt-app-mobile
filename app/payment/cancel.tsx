import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function PaymentCancelPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(app)/settings' as any)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View style={styles.container}>
      <Ionicons name="close-circle" size={64} color="rgba(255,255,255,0.3)" />
      <Text style={styles.title}>Paiement annulé</Text>
      <Text style={styles.subtitle}>
        Tu peux souscrire à tout moment depuis les paramètres.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(app)/settings' as any)}
      >
        <Text style={styles.buttonText}>Retour aux paramètres</Text>
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
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#d4a853',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
})
