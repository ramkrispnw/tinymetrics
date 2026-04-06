import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { GlassSurface } from "@/components/ui/glass-surface";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

/**
 * Floating pill-shaped glass tab bar.
 * Positioned absolutely above the safe area bottom, centered with horizontal margins.
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
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            // Skip hidden routes — no icon = not a visible tab
            if (!options.tabBarIcon) return null;

            const isFocused = state.index === index;
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : (options.title ?? route.name);

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
                {isFocused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: colors.primary + "22" },
                    ]}
                  />
                )}
                {options.tabBarIcon?.({
                  color: isFocused ? colors.primary : colors.muted,
                  size: 24,
                  focused: isFocused,
                })}
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? colors.primary : colors.muted,
                      fontWeight: isFocused ? "700" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
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
  },
  pill: {
    // GlassSurface handles border, blur, specular, shadow
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
    minHeight: 48,
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 4,
    right: 4,
    borderRadius: 16,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
