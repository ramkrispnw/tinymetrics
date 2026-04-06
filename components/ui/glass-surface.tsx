import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { useGlassTokens } from "@/constants/theme";

export interface GlassSurfaceProps extends ViewProps {
  /** Corner radius. Default 20. */
  borderRadius?: number;
  /**
   * When true, renders a 1px specular highlight on the top edge.
   * Enable on floating surfaces (tab bar, banners, snackbar).
   */
  specularHighlight?: boolean;
  /**
   * Optional hex accent color to tint the glass.
   * Applied at vibrancyOpacity so it's a subtle hue shift.
   */
  tintColor?: string;
  /** When true, adds an elevation shadow. Good for floating surfaces. */
  elevated?: boolean;
  /** Padding applied to the inner content wrapper. */
  contentPadding?: number;
  /** Gap applied to the inner content wrapper. */
  contentGap?: number;
}

/**
 * GlassSurface — Liquid Glass material primitive.
 *
 * iOS/Android: real BlurView + translucent overlay layers.
 * Web: semi-transparent surface (BlurView falls back to CSS backdrop-filter automatically).
 */
export function GlassSurface({
  children,
  borderRadius = 20,
  specularHighlight = false,
  tintColor,
  elevated = false,
  contentPadding,
  contentGap,
  style,
  ...props
}: GlassSurfaceProps) {
  const glass = useGlassTokens();

  const shadowStyle = elevated
    ? {
        shadowColor: glass.shadowColor,
        shadowOpacity: glass.shadowOpacity,
        shadowRadius: glass.shadowRadius,
        shadowOffset: glass.shadowOffset,
        elevation: 12,
      }
    : {};

  return (
    <View
      style={[{ borderRadius, overflow: "hidden" }, shadowStyle, style]}
      {...props}
    >
      <BlurView
        intensity={glass.blurIntensity}
        tint="default"
        experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* Semi-transparent overlay */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.surfaceOverlay }]}
      />
      {/* Optional accent vibrancy tint */}
      {tintColor != null && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tintColor, opacity: glass.vibrancyOpacity },
          ]}
        />
      )}
      {/* Glass border ring */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: glass.border,
          },
        ]}
      />
      {/* Specular top-edge highlight */}
      {specularHighlight && (
        <View
          pointerEvents="none"
          style={[
            styles.specular,
            {
              backgroundColor: glass.specular,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
            },
          ]}
        />
      )}
      {/* Content above all glass layers */}
      <View style={[styles.content, contentPadding != null && { padding: contentPadding }, contentGap != null && { gap: contentGap }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 10,
  },
  content: {
    flex: 1,
  },
});
