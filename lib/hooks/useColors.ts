import { useTheme } from '@/lib/ThemeContext'
import { getColors } from '@/lib/themeColors'

export function useColors() {
  const { theme } = useTheme()
  return getColors(theme)
}
