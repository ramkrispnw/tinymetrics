import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { GlassSurface } from "@/components/ui/glass-surface";
import { useColors } from "@/hooks/use-colors";
import { FLOATING_TAB_BAR_HEIGHT } from "@/constants/theme";

/**
 * Floating pill-shaped glass tab bar for iOS 26 Liquid Glass design.
 *
 * - The outer pill is a GlassSurface with blur + specular highlight
 * - Each active tab gets a rounded bubble that covers BOTH the icon and the label
 * - Hidden routes (href: null) are filtered out automatically
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);

  return (
    <View
      style={[styles.wrapper, { bottom: bottomInset + 8 }]}
      pointerEvents="box-none"
    >
      <GlassSurface
        borderRadius={36}
        specularHighlight
        elevated
        tintColor={colors.primary}
        style={styles.pill}
      >
        <View style={styles.tabsRow}>
          {state.routes.map((route) => {
            const { options } = descriptors[route.key];
            // Skip hidden routes (href: null has no tabBarIcon defined)
            if (!options.tabBarIcon) return null;

            const isFocused = state.index === state.routes.indexOf(route);
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : (options.title ?? route.name);
            const iconColor = isFocused ? colors.primary : colors.muted;

            const onPress = () => {
              if (Platform.OS === "ios") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
              >
                {/* Bubble wraps BOTH icon and label */}
                <View
                  style={[
                    styles.bubble,
                    isFocused && {
                      backgroundColor: colors.primary + "22",
                    },
                  ]}
                >
                  {options.tabBarIcon({
                    color: iconColor,
                    size: 22,
                    focused: isFocused,
                  })}
                  <Text
                    style={[
                      styles.label,
                      {
                        color: iconColor,
                        fontWeight: isFocused ? "700" : "500",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 100,
    // Height is the pill content + padding; GlassSurface handles the rest
    height: FLOATING_TAB_BAR_HEIGHT - 32, // subtract bottom inset portion
  },
  pill: {
    flex: 1,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  /** Pill bubble that wraps both icon and label */
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 24,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
