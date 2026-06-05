// Handles OAuth redirect callback (Google Sign-In)
import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
import { getPendingOAuthUrl, clearPendingOAuthUrl } from '@/lib/oauthPending'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Connexion en cours...')

  useEffect(() => {
    const handleOAuth = async () => {
      try {
        // Récupère l'URL capturée par _layout.tsx (toujours monté, pas de timing issue)
        // Petite attente pour s'assurer que le listener de _layout a eu le temps de capturer
        await new Promise(r => setTimeout(r, 150))

        const url = getPendingOAuthUrl()
        clearPendingOAuthUrl()

        console.log('[CALLBACK] URL depuis store global:', url?.substring(0, 100))

        if (!url) {
          // Pas d'URL en attente — vérifie si une session existe déjà
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.id) {
            await redirectUser(data.session.user.id)
          } else {
            router.replace('/auth' as any)
          }
          return
        }

        // Parse les tokens depuis l'URL (implicit flow: #access_token=xxx&refresh_token=yyy)
        const fragment = url.includes('#')
          ? url.split('#')[1]
          : url.includes('?')
          ? url.split('?')[1]
          : ''

        // Parse manuel pour éviter les problèmes avec = dans les JWT
        const parsed: Record<string, string> = {}
        fragment.split('&').forEach(part => {
          const idx = part.indexOf('=')
          if (idx > -1) {
            const key = part.substring(0, idx)
            const value = part.substring(idx + 1)
            parsed[key] = decodeURIComponent(value)
          }
        })

        const access_token = parsed['access_token']
        const refresh_token = parsed['refresh_token'] ?? ''

        if (access_token) {
          setStatus('Connexion...')
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })

          if (error) {
            console.error('[CALLBACK] setSession error:', error.message)
            setStatus('Erreur: ' + error.message)
            setTimeout(() => router.replace('/auth' as any), 2000)
            return
          }

          const userId = data.session?.user?.id
          if (userId) {
            await redirectUser(userId)
            return
          }
        }

        // Aucun token trouvé dans l'URL
        console.warn('[CALLBACK] Aucun access_token dans URL:', fragment.substring(0, 50))
        router.replace('/auth' as any)

      } catch (err: any) {
        console.error('[CALLBACK] Erreur:', err)
        setStatus('Erreur: ' + (err.message ?? 'inconnue'))
        setTimeout(() => router.replace('/auth' as any), 2000)
      }
    }

    const redirectUser = async (userId: string) => {
      setStatus('Chargement du profil...')
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', userId)
        .single()

      if (profile?.is_onboarded) {
        router.replace('/(app)/swipe' as any)
      } else {
        router.replace('/onboarding' as any)
      }
    }

    handleOAuth()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color="#d4a853" />
      <Text style={{ color: '#ffffff66', fontSize: 13 }}>{status}</Text>
    </View>
  )
}
