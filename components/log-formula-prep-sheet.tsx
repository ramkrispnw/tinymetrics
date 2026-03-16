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
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { FormulaPrepData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { DateTimePicker } from "@/components/date-time-picker";

interface Props {
  onClose: () => void;
}

export function LogFormulaPrepSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state } = useStore();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());

  const handleSave = async () => {
    setSaving(true);
    const amountMl =
      state.settings.units === "oz" && amount
        ? Math.round(parseFloat(amount) / 0.033814)
        : amount
          ? parseInt(amount, 10)
          : undefined;

    const data: FormulaPrepData = {
      amountMl,
      notes: notes || undefined,
    };

    await addEvent({
      type: "formula_prep",
      timestamp: eventDate.toISOString(),
      data,
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const presets = [60, 90, 120, 150, 180, 240];

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
            <Text style={[styles.title, { color: colors.foreground }]}>Formula Prep</Text>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={[styles.iconCircle, { backgroundColor: colors.formula + "20" }]}>
              <IconSymbol name="flask.fill" size={36} color={colors.formula} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
              Track formula preparation
            </Text>
          </View>

          {/* Date & Time */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
          <DateTimePicker
            value={eventDate}
            onChange={setEventDate}
            accentColor={colors.formula}
            label="Prep time"
          />

          {/* Quick Presets */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>
            Quick Amount ({state.settings.units})
          </Text>
          <View style={styles.presetsRow}>
            {presets.map((ml) => {
              const displayVal = state.settings.units === "oz"
                ? `${(ml * 0.033814).toFixed(1)} oz`
                : `${ml} ml`;
              return (
                <Pressable
                  key={ml}
                  onPress={() => {
                    const val = state.settings.units === "oz"
                      ? (ml * 0.033814).toFixed(1)
                      : ml.toString();
                    setAmount(val);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.presetBtn,
                    {
                      backgroundColor:
                        amount === (state.settings.units === "oz" ? (ml * 0.033814).toFixed(1) : ml.toString())
                          ? colors.formula + "20"
                          : colors.surface,
                      borderColor:
                        amount === (state.settings.units === "oz" ? (ml * 0.033814).toFixed(1) : ml.toString())
                          ? colors.formula
                          : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        amount === (state.settings.units === "oz" ? (ml * 0.033814).toFixed(1) : ml.toString())
                          ? colors.formula
                          : colors.foreground,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {displayVal}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Amount */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>
            Custom Amount ({state.settings.units})
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={`e.g. ${state.settings.units === "oz" ? "4" : "120"}`}
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
              placeholder="Brand, water temperature, etc..."
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
});
