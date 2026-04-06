import { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { GlassSurface } from "@/components/ui/glass-surface";

export interface UndoSnackbarProps {
  /** Human-readable label, e.g. "Feed deleted" */
  message: string;
  /** Called when the user taps Undo */
  onUndo: () => void;
  /** Called when the timer expires without undo (commit the deletion) */
  onCommit: () => void;
  /** Duration in ms before auto-commit. Default 5000 */
  duration?: number;
}

/**
 * A bottom snackbar that gives the user a grace period to undo a deletion.
 * The parent is responsible for mounting/unmounting this component.
 *
 * Usage:
 *   {pendingDelete && (
 *     <UndoSnackbar
 *       message="Feed deleted"
 *       onUndo={() => setPendingDelete(null)}
 *       onCommit={() => { commitDelete(pendingDelete); setPendingDelete(null); }}
 *     />
 *   )}
 */
export function UndoSnackbar({ message, onUndo, onCommit, duration = 5000 }: UndoSnackbarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Progress bar drains over `duration`
    Animated.timing(progressAnim, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();

    // Auto-commit after duration
    timerRef.current = setTimeout(() => {
      onCommit();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onUndo();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + 80,
          opacity: opacityAnim,
        },
      ]}
    >
      <GlassSurface borderRadius={12} specularHighlight elevated style={styles.surface}>
        {/* Progress bar at top */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border + "60" }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: colors.primary },
            ]}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={1}>
            {message}
          </Text>
          <Pressable
            onPress={handleUndo}
            style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.undoText, { color: colors.primary }]}>UNDO</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  surface: {
    // GlassSurface provides borderRadius, overflow, shadow, border
  },
  progressTrack: {
    height: 3,
    width: "100%",
  },
  progressFill: {
    height: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  undoBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  undoText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
