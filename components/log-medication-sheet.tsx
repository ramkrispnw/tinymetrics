import { useState } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { MedicationData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { DateTimePicker } from "@/components/date-time-picker";
import { scheduleMedicationReminder, cancelMedicationReminders } from "@/lib/notifications";

interface Props {
  onClose: () => void;
}

const FREQUENCY_OPTIONS = [
  { key: "4", label: "Every 4h" },
  { key: "6", label: "Every 6h" },
  { key: "8", label: "Every 8h" },
  { key: "12", label: "Every 12h" },
  { key: "24", label: "Once daily" },
];

export function LogMedicationSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state } = useStore();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("6");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [setReminder, setSetReminder] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const data: MedicationData = {
      name: name.trim(),
      dosage: dosage || undefined,
      frequency: frequency ? `every ${frequency} hours` : undefined,
      notes: notes || undefined,
    };

    await addEvent({
      type: "medication",
      timestamp: eventDate.toISOString(),
      data,
    });

    // Schedule reminder if enabled
    if (setReminder && frequency) {
      const hours = parseInt(frequency, 10);
      await scheduleMedicationReminder(hours, name.trim(), state.profile?.name || "baby");
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>Log Medication</Text>
            <Pressable
              onPress={handleSave}
              disabled={saving || !canSave}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: canSave ? colors.primary : colors.muted }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={[styles.iconCircle, { backgroundColor: colors.medication + "20" }]}>
              <IconSymbol name="pills.fill" size={36} color={colors.medication} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
              Track medication and set reminders
            </Text>
          </View>

          {/* Date & Time */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
          <DateTimePicker
            value={eventDate}
            onChange={setEventDate}
            accentColor={colors.medication}
            label="Given at"
          />

          {/* Medication Name */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Medication Name *</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Vitamin D, Tylenol, Gripe Water"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[styles.textInput, { color: colors.foreground }]}
            />
          </View>

          {/* Dosage */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Dosage</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 0.5 ml, 1 drop, 2.5 mg"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[styles.textInput, { color: colors.foreground }]}
            />
          </View>

          {/* Frequency */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Frequency</Text>
          <View style={styles.frequencyRow}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setFrequency(opt.key);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.freqBtn,
                  {
                    backgroundColor: frequency === opt.key ? colors.medication + "20" : colors.surface,
                    borderColor: frequency === opt.key ? colors.medication : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={{
                    color: frequency === opt.key ? colors.medication : colors.foreground,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Reminder Toggle */}
          <View style={[styles.reminderRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
                Set Reminder
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Get notified when next dose is due
              </Text>
            </View>
            <Switch
              value={setReminder}
              onValueChange={setSetReminder}
              trackColor={{ false: colors.border, true: colors.medication + "60" }}
              thumbColor={setReminder ? colors.medication : colors.muted}
            />
          </View>

          {/* Notes */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Notes (optional)</Text>
          <View style={[styles.notesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Side effects, observations..."
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
  iconSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
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
  frequencyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  freqBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
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
