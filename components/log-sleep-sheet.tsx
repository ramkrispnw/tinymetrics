import { useState, useEffect, useRef, useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function LogSleepSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state, startSleep, stopSleep } = useStore();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualDuration, setManualDuration] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = !!state.activeSleep;

  useEffect(() => {
    if (state.activeSleep) {
      const updateElapsed = () => {
        const start = new Date(state.activeSleep!.startTime).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.activeSleep]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartSleep = async () => {
    await startSleep();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleStopSleep = async () => {
    setSaving(true);
    await stopSleep();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const handleManualSave = async () => {
    if (!manualDuration) return;
    setSaving(true);
    const durationMin = parseInt(manualDuration, 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMin * 60000);

    await addEvent({
      type: "sleep",
      timestamp: startTime.toISOString(),
      data: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMin,
        notes: notes || undefined,
      },
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const presets = [15, 30, 45, 60, 90, 120];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Log Sleep</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Timer Section */}
        <View style={styles.timerSection}>
          <View
            style={[
              styles.timerCircle,
              {
                backgroundColor: isActive ? colors.sleep + "15" : colors.surface,
                borderColor: isActive ? colors.sleep : colors.border,
              },
            ]}
          >
            <IconSymbol name="moon.fill" size={32} color={isActive ? colors.sleep : colors.muted} />
            <Text style={[styles.timerDisplay, { color: colors.foreground }]}>
              {isActive ? formatTimer(elapsed) : "00:00"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {isActive ? "Baby is sleeping" : "Tap to start"}
            </Text>
          </View>

          {isActive ? (
            <Pressable
              onPress={handleStopSleep}
              disabled={saving}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.error + "15", borderColor: colors.error },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <>
                  <IconSymbol name="stop.fill" size={20} color={colors.error} />
                  <Text style={{ color: colors.error, fontWeight: "700", fontSize: 16 }}>
                    Stop Sleep
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleStartSleep}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.sleep + "15", borderColor: colors.sleep },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="play.fill" size={20} color={colors.sleep} />
              <Text style={{ color: colors.sleep, fontWeight: "700", fontSize: 16 }}>
                Start Sleep
              </Text>
            </Pressable>
          )}
        </View>

        {/* Divider */}
        {!isActive && (
          <>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={{ color: colors.muted, fontSize: 13, paddingHorizontal: 12 }}>
                or log manually
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Quick Presets */}
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Quick Duration</Text>
            <View style={styles.presetsRow}>
              {presets.map((min) => (
                <Pressable
                  key={min}
                  onPress={() => {
                    setManualDuration(min.toString());
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.presetBtn,
                    {
                      backgroundColor:
                        manualDuration === min.toString() ? colors.sleep + "20" : colors.surface,
                      borderColor:
                        manualDuration === min.toString() ? colors.sleep : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        manualDuration === min.toString() ? colors.sleep : colors.foreground,
                      fontWeight: manualDuration === min.toString() ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {min >= 60 ? `${min / 60}h` : `${min}m`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Manual Input */}
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Custom (minutes)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={manualDuration}
                onChangeText={setManualDuration}
                placeholder="e.g. 45"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                returnKeyType="done"
                style={[styles.textInput, { color: colors.foreground }]}
              />
            </View>

            {/* Notes */}
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Notes (optional)</Text>
            <View style={[styles.notesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                style={[styles.notesInput, { color: colors.foreground }]}
              />
            </View>

            {/* Save Manual */}
            <Pressable
              onPress={handleManualSave}
              disabled={saving || !manualDuration}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: manualDuration ? colors.sleep : colors.surface,
                  opacity: manualDuration ? 1 : 0.5,
                },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: manualDuration ? "#fff" : colors.muted, fontWeight: "700", fontSize: 16 }}>
                  Save Sleep
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  cancelText: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "700" },
  timerSection: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 16,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    gap: 8,
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    width: "100%",
    maxWidth: 280,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  notesContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  notesInput: {
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: "top",
  },
  saveBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
  },
});
