import { colors as darkColors } from './theme'

const lightColors = {
  // Backgrounds
  bg: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#EFEFEF',
    quaternary: '#E0E0E0',
  },

  // Primary brand color (Gold stays the same)
  primary: '#D4AF37',
  primaryLight: '#E8C547',
  primaryDark: '#B8941F',

  // Accents & states
  accent: '#4F46E5',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  errorDark: '#DC2626',

  // Text
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    quaternary: '#D1D5DB',
    disabled: '#D1D5DB',
  },

  // Borders
  border: {
    primary: '#E5E7EB',
    secondary: '#F0F0F0',
    tertiary: '#FAFAFA',
  },

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.5)',
}

export function getColors(theme: 'light' | 'dark') {
  return theme === 'light' ? lightColors : darkColors
}

export { lightColors, darkColors }
