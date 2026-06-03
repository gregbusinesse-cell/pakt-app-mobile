import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const SUPABASE_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!token) {
      Alert.alert('Lien invalide', 'Ce lien de réinitialisation est invalide.', [
        { text: 'OK', onPress: () => router.replace('/auth' as any) }
      ])
    }
  }, [token])

  const handleSubmit = async () => {
    if (password.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.'); return }
    if (password !== confirm) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ token, newPassword: password }),
      })
      let data: any = {}
      try { data = await res.json() } catch {}
      if (!data.success) { Alert.alert('Erreur', data.error || 'Lien invalide ou expiré. Fais une nouvelle demande.'); return }
      Alert.alert('Mot de passe changé ✅', 'Connecte-toi avec ton nouveau mot de passe.', [
        { text: 'OK', onPress: () => router.replace('/auth' as any) }
      ])
    } catch (e: any) {
      Alert.alert('Erreur réseau', e?.message || 'Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau mot de passe</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-open" size={36} color="#d4a853" />
        </View>
        <Text style={styles.title}>Choisis un nouveau mot de passe</Text>
        <Text style={styles.subtitle}>Au moins 6 caractères.</Text>

        {/* Password field */}
        <View style={styles.fieldWrap}>
          <TextInput
            style={styles.input}
            placeholder="Nouveau mot de passe"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry={!showPwd}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eye}>
            <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Confirm field */}
        <View style={styles.fieldWrap}>
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry={!showConfirm}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eye}>
            <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.btnText}>Valider le nouveau mot de passe</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 28 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(212,168,83,0.1)',
    borderWidth: 1, borderColor: 'rgba(212,168,83,0.2)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20, marginTop: 16,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', marginBottom: 32 },
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12,
    borderWidth: 1, borderColor: '#333',
    marginBottom: 14, height: 52,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1, color: '#fff', fontSize: 15,
    height: 52, paddingVertical: 0,
  },
  eye: { padding: 4 },
  btn: {
    backgroundColor: '#d4a853', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
})
