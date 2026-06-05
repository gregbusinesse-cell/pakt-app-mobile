// Handles OAuth redirect callback (Google Sign-In)
// _layout.tsx capture l'URL, auth.tsx's onAuthStateChange gère la redirection
import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
import { getPendingOAuthUrl, clearPendingOAuthUrl } from '@/lib/oauthPending'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Connexion en cours...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleOAuth = async () => {
      try {
        // Attend 200ms pour que _layout.tsx ait le temps de capturer l'URL
        await new Promise(r => setTimeout(r, 200))

        const url = getPendingOAuthUrl()
        clearPendingOAuthUrl()

        if (!url) {
          // Pas d'URL OAuth — vérifie si une session existe déjà
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.id) {
            // Session déjà valide — onAuthStateChange va rediriger
            return
          }
          router.replace('/auth' as any)
          return
        }

        // Parse le fragment de l'URL (implicit flow: #access_token=xxx&refresh_token=yyy)
        const fragment = url.includes('#')
          ? url.split('#')[1]
          : url.includes('?')
          ? url.split('?')[1]
          : ''

        // Parse manuel pour gérer les = dans les JWT
        const parsed: Record<string, string> = {}
        fragment.split('&').forEach(part => {
          const idx = part.indexOf('=')
          if (idx > -1) {
            parsed[part.substring(0, idx)] = decodeURIComponent(part.substring(idx + 1))
          }
        })

        const access_token = parsed['access_token']
        const refresh_token = parsed['refresh_token'] ?? ''

        if (!access_token) {
          setError('Pas de token dans l\'URL')
          setTimeout(() => router.replace('/auth' as any), 2000)
          return
        }

        setStatus('Connexion...')

        // setSession va déclencher onAuthStateChange dans auth.tsx
        // qui utilisera session directement (pas getSession) → pas de deadlock
        const { error: sessErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (sessErr) {
          setError(sessErr.message)
          setTimeout(() => router.replace('/auth' as any), 2000)
          return
        }

        // onAuthStateChange dans auth.tsx gère la redirection → swipe ou onboarding
        setStatus('Redirection...')

      } catch (err: any) {
        setError(err.message ?? 'Erreur inconnue')
        setTimeout(() => router.replace('/auth' as any), 2000)
      }
    }

    handleOAuth()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color="#d4a853" />
      <Text style={{ color: error ? '#ff4444' : '#ffffff66', fontSize: 13 }}>
        {error ? 'Erreur: ' + error : status}
      </Text>
    </View>
  )
}
