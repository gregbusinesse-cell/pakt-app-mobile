// Handles OAuth redirect callback (Google Sign-In via PKCE flow)
// _layout.tsx capture l'URL, puis callback.tsx échange le code PKCE contre une session
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
        // Attend 300ms pour que _layout.tsx ait le temps de capturer l'URL
        await new Promise(r => setTimeout(r, 300))

        const url = getPendingOAuthUrl()
        clearPendingOAuthUrl()

        if (!url) {
          // Pas d'URL OAuth dans le store — vérifie si une session existe déjà
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.id) {
            // Session déjà valide — onAuthStateChange va rediriger
            return
          }
          router.replace('/auth' as any)
          return
        }

        // Parse l'URL pour trouver les paramètres
        const fragment = url.includes('#')
          ? url.split('#')[1]
          : url.includes('?') ? url.split('?')[1] : ''

        const parsed: Record<string, string> = {}
        fragment.split('&').forEach(part => {
          const idx = part.indexOf('=')
          if (idx > -1) {
            parsed[part.substring(0, idx)] = decodeURIComponent(
              part.substring(idx + 1).replace(/\+/g, ' ')
            )
          }
        })

        // Erreur retournée par Supabase dans l'URL
        if (parsed['error']) {
          setError(parsed['error_description'] || parsed['error'])
          setTimeout(() => router.replace('/auth' as any), 3000)
          return
        }

        // ── PKCE flow (Google + Apple) : échange le code contre une session ──
        if (parsed['code']) {
          setStatus('Échange du code...')
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(url)
          if (exchErr) {
            setError(exchErr.message)
            setTimeout(() => router.replace('/auth' as any), 3000)
            return
          }
          // onAuthStateChange dans _layout.tsx gère la redirection
          setStatus('Redirection...')
          return
        }

        // ── Implicit flow (fallback) : access_token direct dans l'URL ──
        if (parsed['access_token']) {
          setStatus('Connexion...')
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: parsed['access_token'],
            refresh_token: parsed['refresh_token'] ?? '',
          })
          if (sessErr) {
            setError(sessErr.message)
            setTimeout(() => router.replace('/auth' as any), 3000)
            return
          }
          setStatus('Redirection...')
          return
        }

        // Aucun code ni token — retour à /auth
        setError('Authentification échouée')
        setTimeout(() => router.replace('/auth' as any), 3000)

      } catch (err: any) {
        setError(err.message ?? 'Erreur inconnue')
        setTimeout(() => router.replace('/auth' as any), 3000)
      }
    }

    handleOAuth()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
      <ActivityIndicator size="large" color="#D4AF37" />
      <Text style={{ color: error ? '#FF6B6B' : '#ffffff99', fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, fontWeight: '500' }}>
        {error ? 'Erreur: ' + error : status}
      </Text>
    </View>
  )
}
