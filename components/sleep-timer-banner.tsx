import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassSurface } from "@/components/ui/glass-surface";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { getDayKey } from "@/lib/store";
import { LogSleepSheet } from "@/components/log-sleep-sheet";
import * as Haptics from "expo-haptics";

/**
 * A floating banner that appears above the tab bar when a sleep timer is active.
 * Shows elapsed time and allows tapping to open the full sleep sheet.
 * This component should be placed in the tabs layout so it persists across all tabs.
 */
export function SleepTimerBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = !!state.activeSleep;

  // Track whether sleep spans midnight
  const isOvernight = (() => {
    if (!state.activeSleep) return false;
    const startDay = getDayKey(state.activeSleep.startTime);
    const nowDay = getDayKey(new Date().toISOString());
    return startDay !== nowDay;
  })();

  useEffect(() => {
    if (state.activeSleep) {
      const updateElapsed = () => {
        const start = new Date(state.activeSleep!.startTime).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.activeSleep]);

  // Auto-close sheet when sleep is stopped
  useEffect(() => {
    if (!isActive && showSheet) {
      setShowSheet(false);
    }
  }, [isActive, showSheet]);

  if (!isActive) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const timeStr = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Position banner above the floating pill tab bar
  const bottomInset = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const pillBottom = bottomInset + 8;   // matches GlassTabBar wrapper
  const pillHeight = 68;
  const bannerBottom = pillBottom + pillHeight + 8;

  return (
    <>
      <View style={[styles.container, { bottom: bannerBottom }]}>
        <GlassSurface
          borderRadius={28}
          specularHighlight
          elevated
          tintColor={colors.sleep}
          style={styles.surface}
        >
          {/* Sleep-color overlay for strong visual signal */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: colors.sleep + "88", borderRadius: 28 },
            ]}
          />
          <Pressable
            onPress={() => {
              setShowSheet(true);
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={({ pressed }) => [
              styles.banner,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.leftSection}>
              <View style={styles.pulseIndicator}>
                <View style={[styles.pulseDot, { backgroundColor: "#fff" }]} />
              </View>
              <IconSymbol name="moon.fill" size={16} color="#fff" />
              <Text style={styles.label}>
                {isOvernight ? "🌙 " : ""}Sleeping
              </Text>
            </View>
            <View style={styles.rightSection}>
              <Text style={styles.timer}>{timeStr}</Text>
              <Text style={styles.tapHint}>Tap to stop</Text>
            </View>
          </Pressable>
        </GlassSurface>
      </View>

      <Modal
        visible={showSheet}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <LogSleepSheet onClose={() => setShowSheet(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 100,
  },
  surface: {
    // GlassSurface handles border, blur, specular, shadow
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rightSection: {
    alignItems: "flex-end",
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  timer: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tapHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "500",
  },
});
