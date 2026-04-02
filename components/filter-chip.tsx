import { Platform, Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** "solid" = full primary bg (default); "tinted" = 20% opacity primary bg */
  activeStyle?: "solid" | "tinted";
};

export function FilterChip({ label, active, onPress, activeStyle = "solid" }: FilterChipProps) {
  const colors = useColors();

  const bgColor = active
    ? activeStyle === "tinted"
      ? colors.primary + "20"
      : colors.primary
    : colors.surface;
  const borderColor = active ? colors.primary : colors.border + "80";
  const textColor = active
    ? activeStyle === "tinted"
      ? colors.primary
      : "#fff"
    : colors.foreground;

  return (
    <Pressable
      onPress={() => {
        onPress();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        alignSelf: "flex-start",
        flexShrink: 0,
        backgroundColor: bgColor,
        borderColor,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: active ? "700" : "600", color: textColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
