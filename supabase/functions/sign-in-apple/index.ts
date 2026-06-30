import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

interface AppleToken {
  iss: string
  aud: string
  sub: string
  email?: string
  email_verified?: boolean
  iat: number
  exp: number
}

function decodeJWT(token: string): AppleToken {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token format')
  const decoded = JSON.parse(atob(parts[1]))
  return decoded
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { identityToken } = await req.json()

    if (!identityToken) {
      throw new Error('identityToken is required')
    }

    // Decode token (basic validation - just decode without signature verification for dev)
    const payload = decodeJWT(identityToken)

    if (!payload.sub) {
      throw new Error('No user ID in token')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Extract email (may not always be available on subsequent logins)
    const email = payload.email || `${payload.sub}@apple.local`

    // Check if user already exists (by Apple ID in metadata)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.user_metadata?.apple_id === payload.sub
    )

    let userId: string

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create new user via auth.admin
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          provider: 'apple',
          apple_id: payload.sub,
        },
      })

      if (authError) throw authError

      userId = authUser.user.id

      // Create profile for new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          provider: 'apple',
        })

      if (profileError && !profileError.message.includes('duplicate')) throw profileError
    }

    // Generate session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      userId: userId,
    })

    if (sessionError) throw sessionError

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: sessionData?.session?.access_token,
          refresh_token: sessionData?.session?.refresh_token,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Sign-in error:', error)
    return new Response(
      JSON.stringify({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
