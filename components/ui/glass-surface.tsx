import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useGlassTokens } from "@/constants/theme";

export interface GlassSurfaceProps extends ViewProps {
  /** Corner radius. Default 20 */
  borderRadius?: number;
  /**
   * When true, renders a 1px specular highlight on the top edge.
   * Enable on floating surfaces (tab bar, snackbar, banners).
   */
  specularHighlight?: boolean;
  /**
   * Optional accent color (hex) to tint the glass material.
   * Uses vibrancyOpacity from tokens.
   */
  tintColor?: string;
  /** When true, adds elevation shadow underneath. Good for floating surfaces. */
  elevated?: boolean;
}

/**
 * GlassSurface — Liquid Glass material primitive.
 *
 * On iOS/Android: real BlurView with translucent overlay.
 * On web: semi-transparent surface with CSS backdrop-filter.
 */
export function GlassSurface({
  children,
  borderRadius = 20,
  specularHighlight = false,
  tintColor,
  elevated = false,
  style,
  ...props
}: GlassSurfaceProps) {
  const glass = useGlassTokens();
  const colorScheme = useColorScheme();

  const shadowStyle = elevated
    ? {
        shadowColor: glass.shadowColor,
        shadowOpacity: glass.shadowOpacity,
        shadowRadius: glass.shadowRadius,
        shadowOffset: glass.shadowOffset,
        elevation: 12,
      }
    : {};

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          {
            borderRadius,
            overflow: "hidden",
            backgroundColor: glass.surfaceOverlay,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: glass.border,
            // @ts-ignore — web-only CSS property
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          },
          shadowStyle,
          style,
        ]}
        {...props}
      >
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
        {tintColor && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: tintColor,
                opacity: glass.vibrancyOpacity,
                borderRadius,
              },
            ]}
          />
        )}
        {children}
      </View>
    );
  }

  // iOS / Android: real BlurView
  return (
    <View style={[{ borderRadius, overflow: "hidden" }, shadowStyle, style]} {...props}>
      <BlurView
        intensity={glass.blurIntensity}
        tint={colorScheme === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Semi-transparent overlay for body */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: glass.surfaceOverlay }]}
      />
      {/* Optional accent vibrancy tint */}
      {tintColor && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: tintColor, opacity: glass.vibrancyOpacity },
          ]}
        />
      )}
      {/* Glass border overlay */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: glass.border,
          },
        ]}
      />
      {/* Specular top highlight */}
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
      <View style={{ flex: 1 }}>{children}</View>
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
});
