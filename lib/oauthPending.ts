// Store global pour capturer l'URL OAuth avant qu'Expo Router navigue
// _layout.tsx écoute l'URL, auth/callback.tsx la lit ici
let pendingUrl: string | null = null

export const setPendingOAuthUrl = (url: string) => {
  pendingUrl = url
}

export const getPendingOAuthUrl = (): string | null => {
  return pendingUrl
}

export const clearPendingOAuthUrl = () => {
  pendingUrl = null
}
