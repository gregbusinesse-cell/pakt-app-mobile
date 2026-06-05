// Handles OAuth redirect callback (Google Sign-In)
// pakt://auth/callback?code=xxx → Expo Router navigue ici avec code en paramètre
import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  // Expo Router parse automatiquement ?code=xxx en params
  const params = useLocalSearchParams<{
    code?: string
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }>()
  const [status, setStatus] = useState('Connexion en cours...')

  useEffect(() => {
    const handleOAuth = async () => {
      try {
        // Erreur OAuth (ex: utilisateur a annulé)
        if (params.error) {
          console.error('[CALLBACK] OAuth error:', params.error, params.error_description)
          router.replace('/auth' as any)
          return
        }

        const code = params.code as string | undefined

        if (code) {
          // PKCE flow — échange le code contre une session Supabase
          setStatus('Échange du code...')
          console.log('[CALLBACK] Code PKCE reçu, échange...')

          const { data, error } = await supabase.auth.exchangeCodeForSession(
            `pakt://auth/callback?code=${code}`
          )

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
            console.warn('[CALLBACK] Session créée mais pas de userId')
            router.replace('/auth' as any)
          }
          return
        }

        // Implicit flow fallback (access_token dans query params)
        const access_token = params.access_token as string | undefined
        const refresh_token = (params.refresh_token as string | undefined) ?? ''

        if (access_token) {
          setStatus('Connexion...')
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (error) {
            console.error('[CALLBACK] setSession error:', error.message)
            router.replace('/auth' as any)
            return
          }
          const userId = data.session?.user?.id
          if (userId) {
            await redirectUser(userId)
            return
          }
        }

        // Aucun token dans les params — vérifie si une session existe déjà
        const { data } = await supabase.auth.getSession()
        if (data.session?.user?.id) {
          await redirectUser(data.session.user.id)
        } else {
          console.warn('[CALLBACK] Aucun token et aucune session')
          router.replace('/auth' as any)
        }

      } catch (err: any) {
        console.error('[CALLBACK] Erreur inattendue:', err)
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
