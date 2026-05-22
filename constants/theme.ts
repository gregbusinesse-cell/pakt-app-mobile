export const Colors = {
  gold: '#d4a853',
  goldLight: '#e8c47a',
  goldDark: '#b8903e',
  goldMuted: 'rgba(212, 168, 83, 0.15)',

  dark: '#0a0a0a',
  dark100: '#111111',
  dark200: '#1a1a1a',
  dark300: '#242424',
  dark400: '#2e2e2e',
  dark500: '#3a3a3a',

  white: '#ffffff',
  red: '#ef4444',
  green: '#22c55e',

  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  textDimmed: 'rgba(255, 255, 255, 0.2)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
} as const;

export const Fonts = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
  black: 'System',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;
