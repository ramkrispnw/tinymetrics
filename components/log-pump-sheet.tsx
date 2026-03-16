import { useState, useEffect, useRef } from "react";
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
import type { PumpSide, PumpData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { DateTimePicker } from "@/components/date-time-picker";

interface Props {
  onClose: () => void;
}

export function LogPumpSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state } = useStore();
  const [side, setSide] = useState<PumpSide>("both");
  const [amount, setAmount] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleTimer = () => {
    if (timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setTimerRunning(false);
      setDurationMin(Math.ceil(timerSeconds / 60).toString());
    } else {
      setTimerSeconds(0);
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
      setTimerRunning(true);
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    setSaving(true);
    const amountMl =
      state.settings.units === "oz" && amount
        ? Math.round(parseFloat(amount) / 0.033814)
        : amount
          ? parseInt(amount, 10)
          : undefined;

    const data: PumpData = {
      side,
      amountMl,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
      notes: notes || undefined,
    };

    await addEvent({
      type: "pump",
      timestamp: eventDate.toISOString(),
      data,
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const sides: { key: PumpSide; label: string; icon: string }[] = [
    { key: "left", label: "Left", icon: "L" },
    { key: "right", label: "Right", icon: "R" },
    { key: "both", label: "Both", icon: "B" },
  ];

  const pumpColor = colors.pump;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Log Pump</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={pumpColor} />
            ) : (
              <Text style={[styles.saveText, { color: pumpColor }]}>Save</Text>
            )}
          </Pressable>
        </View>

        {/* Date & Time */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
        <DateTimePicker
          value={eventDate}
          onChange={setEventDate}
          accentColor={pumpColor}
          label="Pump time"
        />

        {/* Side Selector */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Side</Text>
        <View style={styles.sideRow}>
          {sides.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => {
                setSide(s.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.sideBtn,
                {
                  backgroundColor: side === s.key ? pumpColor + "20" : colors.surface,
                  borderColor: side === s.key ? pumpColor : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: side === s.key ? pumpColor : colors.foreground,
                  fontWeight: side === s.key ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>
          Output ({state.settings.units})
        </Text>
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={`e.g. ${state.settings.units === "oz" ? "3" : "90"}`}
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            returnKeyType="done"
            style={[styles.textInput, { color: colors.foreground }]}
          />
          <Text style={{ color: colors.muted, fontSize: 14 }}>{state.settings.units}</Text>
        </View>

        {/* Timer */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Duration</Text>
        <View style={styles.timerContainer}>
          <Text style={[styles.timerDisplay, { color: colors.foreground }]}>
            {formatTimer(timerSeconds)}
          </Text>
          <Pressable
            onPress={toggleTimer}
            style={({ pressed }) => [
              styles.timerBtn,
              {
                backgroundColor: timerRunning ? colors.error + "20" : pumpColor + "20",
                borderColor: timerRunning ? colors.error : pumpColor,
              },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <IconSymbol
              name={timerRunning ? "stop.fill" : "play.fill"}
              size={20}
              color={timerRunning ? colors.error : pumpColor}
            />
            <Text
              style={{
                color: timerRunning ? colors.error : pumpColor,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              {timerRunning ? "Stop" : "Start"}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 12 }]}>
          Or enter minutes manually
        </Text>
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={durationMin}
            onChangeText={setDurationMin}
            placeholder="e.g. 20"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            returnKeyType="done"
            style={[styles.textInput, { color: colors.foreground }]}
          />
          <Text style={{ color: colors.muted, fontSize: 14 }}>min</Text>
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
  saveText: { fontSize: 16, fontWeight: "700" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  sideRow: {
    flexDirection: "row",
    gap: 8,
  },
  sideBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  timerContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  timerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
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
});
