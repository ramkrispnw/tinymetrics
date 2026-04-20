import React, { useEffect, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export interface SyncStatusIndicatorProps {
  status: "idle" | "syncing" | "success" | "error";
  error?: string | null;
}

/**
 * Sync Status Indicator
 * Shows loading spinner while syncing, checkmark on success, and error icon on failure
 */
export function SyncStatusIndicator({ status, error }: SyncStatusIndicatorProps) {
  const colors = useColors();
  const [spinAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));

  // Spin animation for loading state
  useEffect(() => {
    if (status === "syncing") {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  // Fade animation for success/error states
  useEffect(() => {
    if (status === "success" || status === "error") {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status, fadeAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (status === "idle") {
    return null;
  }

  return (
    <Animated.View
      style={{
        opacity: status === "syncing" ? 1 : fadeAnim,
        transform: status === "syncing" ? [{ rotate: spinInterpolate }] : [],
      }}
    >
      {status === "syncing" && (
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="cloud-upload" size={18} color={colors.primary} />
          <Text className="text-sm text-muted">Syncing...</Text>
        </View>
      )}

      {status === "success" && (
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="check-circle" size={18} color={colors.success} />
          <Text className="text-sm text-success">Synced</Text>
        </View>
      )}

      {status === "error" && (
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="error" size={18} color={colors.error} />
          <Text className="text-sm text-error">{error || "Sync failed"}</Text>
        </View>
      )}
    </Animated.View>
  );
}
