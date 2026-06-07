// Modern tech-forward design system
export const colors = {
  // Backgrounds
  bg: {
    primary: '#0a0a0a',     // Main dark background
    secondary: '#0f0f0f',    // Slightly lighter
    tertiary: '#1a1a1a',     // Card/container backgrounds
    quaternary: '#2a2a2a',   // Hover states
  },

  // Primary brand color (refined gold)
  primary: '#D4AF37',
  primaryLight: '#E8C547',
  primaryDark: '#B8941F',

  // Accents & states
  accent: '#4F46E5',         // Modern blue
  success: '#10B981',        // Modern green
  warning: '#F59E0B',        // Modern amber
  error: '#EF4444',          // Modern red
  errorDark: '#DC2626',

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#FFFFFF99',
    tertiary: '#FFFFFF77',
    quaternary: '#FFFFFF66',
    disabled: '#FFFFFF44',
  },

  // Borders
  border: {
    primary: '#333333',
    secondary: '#2a2a2a',
    tertiary: '#1f1f1f',
  },

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.8)',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
}

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
}

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  glow: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
}

export const typography = {
  h1: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 56,
  },
  h2: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 44,
  },
  h3: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 36,
  },
  h4: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: 28,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    lineHeight: 18,
  },
}

export const transitions = {
  fast: 150,
  normal: 300,
  slow: 500,
}
