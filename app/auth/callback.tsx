// Handles OAuth redirect callback (Google Sign-In)
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
import * as Linking from 'expo-linking'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const processUrl = async (url: string | null) => {
      console.log('[CALLBACK] URL reçue:', url)

      if (!url) {
        // Pas d'URL, essaie de récupérer la session existante
        const { data } = await supabase.auth.getSession()
        if (data.session?.user?.id) {
          await redirectFromSession(data.session.user.id)
        } else {
          console.warn('[CALLBACK] Aucune URL et aucune session')
          router.replace('/auth' as any)
        }
        return
      }

      try {
        let userId: string | null = null

        if (url.includes('code=')) {
          // PKCE flow — Supabase envoie un code, on l'échange contre une session
          console.log('[CALLBACK] Flow PKCE détecté, échange du code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(url)
          if (error) {
            console.error('[CALLBACK] Erreur PKCE:', error.message)
          } else {
            userId = data.session?.user?.id ?? null
          }
        } else if (url.includes('access_token=')) {
          // Implicit flow — les tokens sont directement dans l'URL
          console.log('[CALLBACK] Flow implicite détecté, extraction des tokens...')
          const fragment = url.includes('#')
            ? url.split('#')[1]
            : url.split('?').slice(1).join('?')
          const params = new URLSearchParams(fragment)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (error) {
              console.error('[CALLBACK] Erreur implicit:', error.message)
            } else {
              userId = data.session?.user?.id ?? null
            }
          }
        } else {
          // Pas de tokens dans l'URL, essaie la session existante
          console.warn('[CALLBACK] Pas de tokens dans l\'URL:', url)
          const { data } = await supabase.auth.getSession()
          userId = data.session?.user?.id ?? null
        }

        if (userId) {
          await redirectFromSession(userId)
        } else {
          console.warn('[CALLBACK] Pas de session après traitement')
          router.replace('/auth' as any)
        }
      } catch (err) {
        console.error('[CALLBACK] Erreur inattendue:', err)
        router.replace('/auth' as any)
      }
    }

    const redirectFromSession = async (userId: string) => {
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

    // Récupère l'URL qui a ouvert cette page (deep link)
    Linking.getInitialURL().then(processUrl)

    // Écoute aussi les URLs reçues pendant que la page est ouverte
    const sub = Linking.addEventListener('url', ({ url }) => processUrl(url))
    return () => sub.remove()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#d4a853" />
    </View>
  )
}
