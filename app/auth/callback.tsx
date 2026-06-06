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
        console.log('[CALLBACK] ✨ Callback page loaded')
        // Attend 200ms pour que _layout.tsx ait le temps de capturer l'URL
        await new Promise(r => setTimeout(r, 200))

        const url = getPendingOAuthUrl()
        console.log('[CALLBACK] URL reçue du store:', url)
        clearPendingOAuthUrl()

        if (!url) {
          console.log('[CALLBACK] ⚠️  Pas d\'URL OAuth dans le store, vérification session directe...')
          // Pas d'URL OAuth — vérifie si une session existe déjà
          const { data } = await supabase.auth.getSession()
          console.log('[CALLBACK] Session directe:', data.session?.user?.id ? '✅ USER LOGGED' : '❌ NO USER')
          if (data.session?.user?.id) {
            // Session déjà valide — onAuthStateChange va rediriger
            console.log('[CALLBACK] Session trouvée, onAuthStateChange va rediriger')
            return
          }
          console.log('[CALLBACK] Pas de session, retour à /auth')
          router.replace('/auth' as any)
          return
        }

        console.log('[CALLBACK] ✅ URL trouvée dans le store')

        // Parse le fragment de l'URL (implicit flow: #access_token=xxx&refresh_token=yyy)
        const fragment = url.includes('#')
          ? url.split('#')[1]
          : url.includes('?')
          ? url.split('?')[1]
          : ''

        console.log('[CALLBACK] Fragment parsé:', fragment.substring(0, 100) + '...')

        // Parse manuel pour gérer les = dans les JWT
        const parsed: Record<string, string> = {}
        fragment.split('&').forEach(part => {
          const idx = part.indexOf('=')
          if (idx > -1) {
            parsed[part.substring(0, idx)] = decodeURIComponent(part.substring(idx + 1))
          }
        })

        console.log('[CALLBACK] Tokens trouvés:', {
          access_token: parsed['access_token'] ? '✅ présent' : '❌ manquant',
          refresh_token: parsed['refresh_token'] ? '✅ présent' : '❌ manquant',
          error: parsed['error'] ? `⚠️ ${parsed['error']}` : 'aucun'
        })

        const access_token = parsed['access_token']
        const refresh_token = parsed['refresh_token'] ?? ''

        // Si pas de token dans l'URL, essayer de récupérer la session directement
        // (parfois Apple Sign In ne passe pas les tokens via deep link)
        if (!access_token) {
          console.log('[CALLBACK] No token in URL, checking session directly...')
          const { data: { session: directSession }, error: sessionErr } = await supabase.auth.getSession()

          if (directSession?.access_token) {
            console.log('[CALLBACK] Found session via getSession()')
            setStatus('Connexion...')
            const { error: sessErr } = await supabase.auth.setSession({
              access_token: directSession.access_token,
              refresh_token: directSession.refresh_token ?? '',
            })

            if (sessErr) {
              setError(sessErr.message)
              setTimeout(() => router.replace('/auth' as any), 2000)
              return
            }

            setStatus('Redirection...')
            return
          }

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
