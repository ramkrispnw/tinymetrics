import { useState, useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  accentColor?: string;
  label?: string;
}

/**
 * A cross-platform date/time picker that works on web and native.
 * Shows a tappable row that opens an inline picker.
 */
export function DateTimePicker({ value, onChange, accentColor, label }: Props) {
  const colors = useColors();
  const accent = accentColor || colors.primary;
  const [showPicker, setShowPicker] = useState(false);

  const formattedDate = useMemo(() => {
    const now = new Date();
    const isToday =
      value.getFullYear() === now.getFullYear() &&
      value.getMonth() === now.getMonth() &&
      value.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      value.getFullYear() === yesterday.getFullYear() &&
      value.getMonth() === yesterday.getMonth() &&
      value.getDate() === yesterday.getDate();

    const dateStr = isToday
      ? "Today"
      : isYesterday
        ? "Yesterday"
        : value.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

    const timeStr = value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return { dateStr, timeStr };
  }, [value]);

  return (
    <>
      <Pressable
        onPress={() => {
          setShowPicker(true);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}
      >
        <IconSymbol name="clock.fill" size={18} color={accent} />
        <View style={{ flex: 1 }}>
          {label && (
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
              {label}
            </Text>
          )}
          <Text style={[styles.dateText, { color: colors.foreground }]}>
            {formattedDate.dateStr} at {formattedDate.timeStr}
          </Text>
        </View>
        <IconSymbol name="pencil" size={14} color={colors.muted} />
      </Pressable>

      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowPicker(false)}
        >
          <Pressable
            style={[styles.pickerContainer, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <DateTimePickerInline
              value={value}
              onChange={onChange}
              accentColor={accent}
              onDone={() => setShowPicker(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Inline Picker ──────────────────────────────────────────────────────────

interface InlineProps {
  value: Date;
  onChange: (date: Date) => void;
  accentColor: string;
  onDone: () => void;
}

function DateTimePickerInline({ value, onChange, accentColor, onDone }: InlineProps) {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(value);

  const handleDone = () => {
    onChange(selectedDate);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  };

  // Generate date options: today and 13 days back
  const dateOptions = useMemo(() => {
    const options: { date: Date; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      const label =
        i === 0
          ? "Today"
          : i === 1
            ? "Yesterday"
            : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      options.push({ date: d, label });
    }
    return options;
  }, [selectedDate]);

  // Generate hour options
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Generate minute options (5 min increments)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const selectedDateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;

  return (
    <View>
      {/* Header */}
      <View style={styles.pickerHeader}>
        <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Set Date & Time</Text>
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.doneText, { color: accentColor }]}>Done</Text>
        </Pressable>
      </View>

      {/* Date Selection */}
      <Text style={[styles.pickerLabel, { color: colors.muted }]}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
        {dateOptions.map((opt, idx) => {
          const optKey = `${opt.date.getFullYear()}-${opt.date.getMonth()}-${opt.date.getDate()}`;
          const isSelected = optKey === selectedDateKey;
          return (
            <Pressable
              key={idx}
              onPress={() => {
                const newDate = new Date(opt.date);
                newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                setSelectedDate(newDate);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.dateChip,
                {
                  backgroundColor: isSelected ? accentColor + "20" : colors.background,
                  borderColor: isSelected ? accentColor : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: isSelected ? accentColor : colors.foreground,
                  fontWeight: isSelected ? "700" : "500",
                  fontSize: 13,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Time Selection */}
      <Text style={[styles.pickerLabel, { color: colors.muted }]}>Time</Text>
      <View style={styles.timeRow}>
        {/* Hour */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center", marginBottom: 6 }}>
            HOUR
          </Text>
          <ScrollView
            style={[styles.timeScroll, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {hours.map((h) => {
              const isSelected = selectedDate.getHours() === h;
              const displayH = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
              return (
                <Pressable
                  key={h}
                  onPress={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setHours(h);
                    setSelectedDate(newDate);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.timeItem,
                    {
                      backgroundColor: isSelected ? accentColor + "20" : "transparent",
                      borderRadius: 8,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? accentColor : colors.foreground,
                      fontWeight: isSelected ? "700" : "400",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {displayH}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Minute */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center", marginBottom: 6 }}>
            MINUTE
          </Text>
          <ScrollView
            style={[styles.timeScroll, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {minutes.map((m) => {
              const isSelected = Math.floor(selectedDate.getMinutes() / 5) * 5 === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setMinutes(m);
                    setSelectedDate(newDate);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.timeItem,
                    {
                      backgroundColor: isSelected ? accentColor + "20" : "transparent",
                      borderRadius: 8,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? accentColor : colors.foreground,
                      fontWeight: isSelected ? "700" : "400",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    :{m.toString().padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Quick time presets */}
      <View style={styles.quickTimeRow}>
        {[
          { label: "Now", offset: 0 },
          { label: "15m ago", offset: -15 },
          { label: "30m ago", offset: -30 },
          { label: "1h ago", offset: -60 },
          { label: "2h ago", offset: -120 },
        ].map((preset) => (
          <Pressable
            key={preset.label}
            onPress={() => {
              const newDate = new Date();
              newDate.setMinutes(newDate.getMinutes() + preset.offset);
              setSelectedDate(newDate);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.quickTimeChip,
              { backgroundColor: colors.background, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "500" }}>
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  dateScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeScroll: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  timeItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 1,
  },
  quickTimeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  quickTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
