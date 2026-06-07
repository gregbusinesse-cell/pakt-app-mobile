import { Image, View, StyleSheet } from 'react-native'

interface ProfileImageProps {
  photos?: string[] | null
  style?: any
  placeholder?: any
}

export function ProfileImage({ photos, style, placeholder }: ProfileImageProps) {
  const SUPABASE_URL = 'https://cpgnczuqhwdoalgyezvr.supabase.co'
  const BUCKET = 'avatars'

  // Get first photo
  const photoPath = photos?.[0]

  if (!photoPath) {
    return <View style={[styles.placeholder, placeholder]} />
  }

  // Build complete URL if it's not already one
  let imageUrl = photoPath
  if (!photoPath.startsWith('http')) {
    imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photoPath}`
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, style, { backgroundColor: '#111' }]}
      resizeMode="cover"
      fadeDuration={150}
      onError={() => console.warn('Failed to load image:', imageUrl)}
    />
  )
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
})
