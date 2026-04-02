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
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { getDayKey } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { DateTimePicker } from "@/components/date-time-picker";

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
  const [eventDate, setEventDate] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = !!state.activeSleep;

  // Compute whether the active sleep spans midnight (overnight)
  const isOvernight = useMemo(() => {
    if (!state.activeSleep) return false;
    const startDay = getDayKey(state.activeSleep.startTime);
    const nowDay = getDayKey(new Date().toISOString());
    return startDay !== nowDay;
  }, [state.activeSleep, elapsed]); // elapsed triggers re-check

  const startTimeLabel = useMemo(() => {
    if (!state.activeSleep) return "";
    const d = new Date(state.activeSleep.startTime);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [state.activeSleep]);

  const startDateLabel = useMemo(() => {
    if (!state.activeSleep) return "";
    const d = new Date(state.activeSleep.startTime);
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }, [state.activeSleep]);

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

  const elapsedMinutes = Math.floor(elapsed / 60);

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
    const endTime = new Date(eventDate.getTime() + durationMin * 60000);
    const startTime = eventDate;

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
    <ScreenContainer edges={["left", "right"]} className="px-4 pt-2">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>
              {isActive ? "Minimize" : "Cancel"}
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Log Sleep</Text>
          <View style={{ width: 60 }} />
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

          {/* Active sleep info */}
          {isActive && (
            <View style={styles.sleepInfoContainer}>
              <View style={[styles.sleepInfoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sleepInfoItem}>
                  <Text style={[styles.sleepInfoLabel, { color: colors.muted }]}>Started</Text>
                  <Text style={[styles.sleepInfoValue, { color: colors.foreground }]}>{startTimeLabel}</Text>
                  {isOvernight && (
                    <Text style={[styles.sleepInfoDate, { color: colors.muted }]}>{startDateLabel}</Text>
                  )}
                </View>
                <View style={[styles.sleepInfoDivider, { backgroundColor: colors.border }]} />
                <View style={styles.sleepInfoItem}>
                  <Text style={[styles.sleepInfoLabel, { color: colors.muted }]}>Duration</Text>
                  <Text style={[styles.sleepInfoValue, { color: colors.foreground }]}>
                    {elapsedMinutes >= 60
                      ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`
                      : `${elapsedMinutes}m`}
                  </Text>
                </View>
              </View>

              {/* Overnight badge */}
              {isOvernight && (
                <View style={[styles.overnightBadge, { backgroundColor: colors.sleep + "20" }]}>
                  <Text style={{ fontSize: 14 }}>🌙</Text>
                  <Text style={[styles.overnightText, { color: colors.sleep }]}>
                    Overnight sleep — tracking across midnight
                  </Text>
                </View>
              )}
            </View>
          )}

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
                    Stop Sleep · {elapsedMinutes >= 60
                      ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`
                      : `${elapsedMinutes}m`}
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
                Start Sleep Timer
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

            {/* Date & Time */}
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
            <DateTimePicker
              value={eventDate}
              onChange={setEventDate}
              accentColor={colors.sleep}
              label="Sleep started at"
            />

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
      </KeyboardAvoidingView>
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
  sleepInfoContainer: {
    width: "100%",
    gap: 10,
  },
  sleepInfoRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sleepInfoItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sleepInfoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sleepInfoValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  sleepInfoDate: {
    fontSize: 11,
    marginTop: 2,
  },
  sleepInfoDivider: {
    width: 1,
  },
  overnightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "center",
  },
  overnightText: {
    fontSize: 13,
    fontWeight: "600",
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
    maxWidth: 320,
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
