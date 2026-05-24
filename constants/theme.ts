import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'ui-serif',
    rounded: 'Lexend',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'Lexend',
    mono: 'monospace',
  },
  web: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Lexend', 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Tokens = {
  surface: '#f8faf7',
  'surface-dim': '#d8dbd8',
  'surface-bright': '#f8faf7',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f2f4f1',
  'surface-container': '#eceeeb',
  'surface-container-high': '#e7e9e6',
  'surface-container-highest': '#e1e3e0',
  'on-surface': '#191c1b',
  'on-surface-variant': '#404846',
  'inverse-surface': '#2e312f',
  'inverse-on-surface': '#eff1ee',
  outline: '#717976',
  'outline-variant': '#c0c8c5',
  'surface-tint': '#3b665d',
  primary: '#001c17',
  'on-primary': '#ffffff',
  'primary-container': '#00332b',
  'on-primary-container': '#709c91',
  'inverse-primary': '#a2d0c4',
  secondary: '#006b59',
  'on-secondary': '#ffffff',
  'secondary-container': '#9df3dc',
  'on-secondary-container': '#0c715f',
  tertiary: '#735c00',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#cba72f',
  'on-tertiary-container': '#4e3d00',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  'primary-fixed': '#bdece0',
  'primary-fixed-dim': '#a2d0c4',
  'on-primary-fixed': '#00201b',
  'on-primary-fixed-variant': '#224e45',
  'secondary-fixed': '#9df3dc',
  'secondary-fixed-dim': '#81d6c0',
  'on-secondary-fixed': '#00201a',
  'on-secondary-fixed-variant': '#005143',
  'tertiary-fixed': '#ffe088',
  'tertiary-fixed-dim': '#e9c349',
  'on-tertiary-fixed': '#241a00',
  'on-tertiary-fixed-variant': '#574500',
  background: '#f8faf7',
  'on-background': '#191c1b',
  'surface-variant': '#e1e3e0',
};

export const Typography = {
  'headline-xl': { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, fontFamily: 'Lexend-Bold', letterSpacing: -0.5 },
  'headline-lg': { fontSize: 24, lineHeight: 30, fontWeight: '600' as const, fontFamily: 'Lexend-SemiBold', letterSpacing: -0.3 },
  'headline-md': { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, fontFamily: 'Lexend-SemiBold' },
  'headline-sm': { fontSize: 17, lineHeight: 22, fontWeight: '500' as const, fontFamily: 'Lexend' },
  'body-lg': { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, fontFamily: 'Inter' },
  'body-md': { fontSize: 14, lineHeight: 19, fontWeight: '400' as const, fontFamily: 'Inter' },
  'label-lg': { fontSize: 15, lineHeight: 19, fontWeight: '600' as const, fontFamily: 'Inter-SemiBold' },
  'label-md': { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, fontFamily: 'Inter-Medium' },
  'headline-lg-mobile': { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, fontFamily: 'Lexend-SemiBold' },
  'body-lg-mobile': { fontSize: 15, lineHeight: 21, fontWeight: '400' as const, fontFamily: 'Inter-Italic' },
};

export const Spacing = {
  xs: 4,
  base: 6,
  sm: 10,
  md: 18,
  lg: 28,
  xl: 40,
  gutter: 14,
  'margin-mobile': 16,
  'margin-desktop': 36,
};

export const BorderRadius = {
  sm: 4,
  DEFAULT: 8,
  lg: 10,
  xl: 12,
  full: 9999,
};
