import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'

export default function DeleteAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    Alert.alert(
      'Dernière confirmation',
      'Cette action est définitive. Ton compte, tes matchs, tes conversations et toutes tes données seront supprimés pour toujours.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) {
                Alert.alert('Erreur', 'Session expirée. Reconnecte-toi.')
                return
              }

              // Call Edge Function to delete account
              const SUPABASE_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
              const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ25jenVxaHdkb2FsZ3llenZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjA2NDcsImV4cCI6MjA5NTE5NjY0N30.GagM-CyNkl9YJmor26eepk3DF3EWcRsa7xnFIZyBeFY'

              const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': ANON_KEY,
                },
              })

              const data = await res.json()

              if (!data.success) {
                Alert.alert('Erreur', data.error || 'Impossible de supprimer le compte.')
                return
              }

              // Sign out and go to auth
              await supabase.auth.signOut()
              router.replace('/auth' as any)

            } catch (err: any) {
              Alert.alert('Erreur', err?.message || 'Une erreur est survenue.')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Supprimer mon compte</Text>
      </View>

      <View style={styles.content}>
        {/* Warning icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="warning" size={40} color="#ff4444" />
        </View>

        <Text style={styles.title}>Tu vas perdre tout ça</Text>

        {/* What will be deleted */}
        {[
          { icon: 'heart', text: 'Tous tes matchs et conversations' },
          { icon: 'person', text: 'Ton profil et tes photos' },
          { icon: 'star', text: 'Ton historique et tes likes' },
          { icon: 'card', text: 'Ton abonnement actif' },
        ].map((item, i) => (
          <View key={i} style={styles.item}>
            <Ionicons name={item.icon as any} size={18} color="#ff4444" />
            <Text style={styles.itemText}>{item.text}</Text>
          </View>
        ))}

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Cette action est <Text style={{ fontWeight: '800', color: '#ff4444' }}>définitive et irréversible</Text>.
            Il n'est pas possible de récupérer ton compte une fois supprimé.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, loading && { opacity: 0.6 }]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 24 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 24,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 24 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderRadius: 10, padding: 14, marginBottom: 10,
  },
  itemText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, flex: 1 },
  warningBox: {
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 12, padding: 16, marginTop: 12,
  },
  warningText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 },
  footer: { padding: 20, gap: 12 },
  cancelBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  cancelBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: {
    backgroundColor: '#cc2222', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
