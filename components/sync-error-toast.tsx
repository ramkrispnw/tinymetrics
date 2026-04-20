import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

export interface SyncErrorToastProps {
  visible: boolean;
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Sync Error Toast Notification
 * Shows error message with retry button that slides up from bottom
 */
export function SyncErrorToast({ visible, error, onRetry, onDismiss }: SyncErrorToastProps) {
  const colors = useColors();
  const [slideAnim] = useState(new Animated.Value(0));
  const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);
      setAutoHideTimer(timer);

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();

      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        setAutoHideTimer(null);
      }
    }

    return () => {
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, [visible, slideAnim]);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry();
    handleDismiss();
  };

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      <View
        className="bg-error/90 backdrop-blur-md rounded-t-3xl px-4 py-3 flex-row items-center justify-between gap-3"
        style={{ backgroundColor: colors.error + "E6" }}
      >
        <View className="flex-row items-center flex-1 gap-3">
          <MaterialIcons name="error" size={20} color={colors.background} />
          <Text className="text-sm font-medium text-background flex-1" numberOfLines={2}>
            {error}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={handleRetry}
            style={({ pressed }) => [
              {
                backgroundColor: colors.background,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 6,
              },
            ]}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.error }}>
              Retry
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.6 : 1,
                paddingHorizontal: 8,
                paddingVertical: 8,
              },
            ]}
          >
            <MaterialIcons name="close" size={18} color={colors.background} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
