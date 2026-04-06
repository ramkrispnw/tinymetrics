export const themeColors: {
  primary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  feed: { light: string; dark: string };
  sleep: { light: string; dark: string };
  diaper: { light: string; dark: string };
  observation: { light: string; dark: string };
  pump: { light: string; dark: string };
  formula: { light: string; dark: string };
  medication: { light: string; dark: string };
};

export const glassTokens: {
  blurIntensity: { light: number; dark: number };
  surfaceOverlay: { light: string; dark: string };
  border: { light: string; dark: string };
  specular: { light: string; dark: string };
  vibrancyOpacity: number;
  shadow: {
    color: string;
    opacity: { light: number; dark: number };
    radius: number;
    offset: { width: number; height: number };
  };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
  glassTokens: typeof glassTokens;
};

export default themeConfig;
