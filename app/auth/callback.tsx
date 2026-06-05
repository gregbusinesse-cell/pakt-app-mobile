// Handles OAuth redirect callback (Google Sign-In)
// Expo Router navigue ici quand le deep link pakt://auth/callback?code=xxx est reçu
import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase/client'
import * as Linking from 'expo-linking'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Connexion en cours...')

  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) {
        // Pas d'URL initiale — attendre le listener
        return
      }

      console.log('[CALLBACK] URL reçue:', url)

      try {
        if (url.includes('code=')) {
          // PKCE flow — échange le code contre une session complète
          setStatus('Échange du code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(url)

          if (error) {
            console.error('[CALLBACK] Erreur PKCE:', error.message)
            setStatus('Erreur: ' + error.message)
            setTimeout(() => router.replace('/auth' as any), 2000)
            return
          }

          const userId = data.session?.user?.id
          if (userId) {
            await redirectUser(userId)
          } else {
            router.replace('/auth' as any)
          }

        } else if (url.includes('access_token=')) {
          // Implicit flow fallback
          setStatus('Connexion...')
          const fragment = url.includes('#')
            ? url.split('#')[1]
            : url.split('?').slice(1).join('?')

          // Parse manuellement pour éviter les problèmes avec = dans les JWT
          const parsed: Record<string, string> = {}
          fragment.split('&').forEach(part => {
            const idx = part.indexOf('=')
            if (idx > -1) {
              parsed[part.substring(0, idx)] = decodeURIComponent(part.substring(idx + 1))
            }
          })

          const access_token = parsed['access_token']
          const refresh_token = parsed['refresh_token'] ?? ''

          if (access_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            })

            if (error) {
              console.error('[CALLBACK] Erreur setSession:', error.message)
              router.replace('/auth' as any)
              return
            }

            const userId = data.session?.user?.id
            if (userId) {
              await redirectUser(userId)
            } else {
              router.replace('/auth' as any)
            }
          } else {
            router.replace('/auth' as any)
          }

        } else {
          // URL sans tokens — essaie la session existante
          const { data } = await supabase.auth.getSession()
          if (data.session?.user?.id) {
            await redirectUser(data.session.user.id)
          } else {
            router.replace('/auth' as any)
          }
        }
      } catch (err) {
        console.error('[CALLBACK] Erreur inattendue:', err)
        router.replace('/auth' as any)
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

    // Écoute les URLs reçues pendant que le composant est monté
    // (cas principal: app en foreground quand le deep link arrive)
    const sub = Linking.addEventListener('url', ({ url }) => {
      console.log('[CALLBACK] URL event reçue:', url)
      processUrl(url)
    })

    // Aussi vérifier getInitialURL (cas: app ouverte depuis le deep link)
    Linking.getInitialURL().then(url => {
      if (url && (url.includes('code=') || url.includes('access_token='))) {
        processUrl(url)
      }
    })

    return () => sub.remove()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color="#d4a853" />
      <Text style={{ color: '#ffffff66', fontSize: 13 }}>{status}</Text>
    </View>
  )
}
