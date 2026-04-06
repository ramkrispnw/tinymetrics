/** @type {const} */
const themeColors = {
  primary: { light: '#6C63FF', dark: '#8B83FF' },
  background: { light: '#FAFBFC', dark: '#121416' },
  surface: { light: '#FFFFFF', dark: '#1C1E22' },
  foreground: { light: '#1A1D21', dark: '#F0F1F3' },
  muted: { light: '#6B7280', dark: '#9CA3AF' },
  border: { light: '#E5E7EB', dark: '#2D3139' },
  success: { light: '#10B981', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error: { light: '#EF4444', dark: '#F87171' },
  feed: { light: '#3B82F6', dark: '#60A5FA' },
  sleep: { light: '#8B5CF6', dark: '#A78BFA' },
  diaper: { light: '#F97316', dark: '#FB923C' },
  observation: { light: '#EC4899', dark: '#F472B6' },
  pump: { light: '#E879A0', dark: '#F0A0B8' },
  formula: { light: '#14B8A6', dark: '#2DD4BF' },
  medication: { light: '#06B6D4', dark: '#22D3EE' },
};

/** @type {const} */
const glassTokens = {
  /** Native blur intensity (expo-blur) */
  blurIntensity: { light: 60, dark: 55 },
  /** Semi-transparent overlay applied on top of blur */
  surfaceOverlay: {
    light: "rgba(255,255,255,0.45)",
    dark: "rgba(28,30,34,0.58)",
  },
  /** Glass border ring color */
  border: {
    light: "rgba(255,255,255,0.65)",
    dark: "rgba(255,255,255,0.08)",
  },
  /** Top-edge specular highlight */
  specular: {
    light: "rgba(255,255,255,0.55)",
    dark: "rgba(255,255,255,0.05)",
  },
  /** Accent vibrancy overlay opacity */
  vibrancyOpacity: 0.07,
  /** Elevation shadow */
  shadow: {
    color: "#000",
    opacity: { light: 0.1, dark: 0.4 },
    radius: 24,
    offset: { width: 0, height: 8 },
  },
};

module.exports = { themeColors, glassTokens };
