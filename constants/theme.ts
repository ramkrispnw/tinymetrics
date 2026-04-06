/**
 * Thin re-exports so consumers don't need to know about internal theme plumbing.
 * Full implementation lives in lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  GlassTokens,
  SchemeColors,
  ThemeColors,
  useGlassTokens,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/lib/_core/theme";

export const FLOATING_TAB_BAR_HEIGHT = 100;
