export function getColors(theme: 'dark' | 'light') {
  if (theme === 'light') {
    return {
      bg: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
        tertiary: '#EFEFEF',
        quaternary: '#E8E8E8',
      },
      primary: '#D4AF37',
      primaryLight: '#E8C547',
      primaryDark: '#B8941F',
      accent: '#4F46E5',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      errorDark: '#DC2626',
      text: {
        primary: '#1F2937',
        secondary: '#4B5563',
        tertiary: '#6B7280',
        quaternary: '#9CA3AF',
        disabled: '#D1D5DB',
      },
      border: {
        primary: '#E5E7EB',
        secondary: '#D1D5DB',
        tertiary: '#E9ECEF',
      },
      overlay: 'rgba(0, 0, 0, 0.2)',
      overlayDark: 'rgba(0, 0, 0, 0.3)',
    }
  }

  // Dark mode (default)
  return {
    bg: {
      primary: '#0a0a0a',
      secondary: '#0f0f0f',
      tertiary: '#1a1a1a',
      quaternary: '#2a2a2a',
    },
    primary: '#D4AF37',
    primaryLight: '#E8C547',
    primaryDark: '#B8941F',
    accent: '#4F46E5',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    errorDark: '#DC2626',
    text: {
      primary: '#FFFFFF',
      secondary: '#FFFFFF99',
      tertiary: '#FFFFFF77',
      quaternary: '#FFFFFF66',
      disabled: '#FFFFFF44',
    },
    border: {
      primary: '#333333',
      secondary: '#2a2a2a',
      tertiary: '#1f1f1f',
    },
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayDark: 'rgba(0, 0, 0, 0.8)',
  }
}
