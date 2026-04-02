import { useState, useEffect, useCallback } from "react";
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
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { MedicationData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { DateTimePicker } from "@/components/date-time-picker";
import { scheduleMedicationReminder } from "@/lib/notifications";

interface Props {
  onClose: () => void;
}

const CUSTOM_MEDS_KEY = "tinymetrics_custom_medications";

const BUILT_IN_MEDICATIONS = [
  { category: "Vitamins", items: ["Vitamin D Drops", "Iron Supplement", "Multivitamin Drops"] },
  { category: "Pain / Fever", items: ["Infant Tylenol (Acetaminophen)", "Infant Advil (Ibuprofen)"] },
  { category: "Digestive", items: ["Gripe Water", "Gas Drops (Simethicone)", "Probiotic Drops"] },
  { category: "Allergy / Nasal", items: ["Antihistamine (Cetirizine)", "Saline Nasal Drops"] },
];

const FREQUENCY_OPTIONS = [
  { key: "4", label: "Every 4h" },
  { key: "6", label: "Every 6h" },
  { key: "8", label: "Every 8h" },
  { key: "12", label: "Every 12h" },
  { key: "24", label: "Once daily" },
];

async function loadCustomMedications(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MEDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveCustomMedications(meds: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOM_MEDS_KEY, JSON.stringify(meds));
  } catch (e) {
    console.error("[Medication] Failed to save custom meds:", e);
  }
}

export function LogMedicationSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state } = useStore();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("6");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [setReminder, setSetReminder] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [customMeds, setCustomMeds] = useState<string[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(true);

  // Load custom medications on mount
  useEffect(() => {
    loadCustomMedications().then((meds) => {
      setCustomMeds(meds);
      setLoadingCustom(false);
    });
  }, []);

  const medicationName = isCustom ? customName.trim() : (selectedPreset || "");
  const canSave = medicationName.length > 0;

  // Check if a custom name already exists in built-in or custom lists
  const isNameDuplicate = useCallback((name: string): boolean => {
    const lower = name.toLowerCase().trim();
    for (const group of BUILT_IN_MEDICATIONS) {
      if (group.items.some((i) => i.toLowerCase() === lower)) return true;
    }
    return customMeds.some((m) => m.toLowerCase() === lower);
  }, [customMeds]);

  const handleSelectPreset = (name: string) => {
    setSelectedPreset(name);
    setIsCustom(false);
    setShowPicker(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectCustom = () => {
    setSelectedPreset(null);
    setIsCustom(true);
    setShowPicker(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleChangeMedication = () => {
    setShowPicker(true);
    setSelectedPreset(null);
    setIsCustom(false);
    setCustomName("");
  };

  const handleDeleteCustomMed = (name: string) => {
    Alert.alert(
      "Remove Medication",
      `Remove "${name}" from your custom list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updated = customMeds.filter((m) => m !== name);
            setCustomMeds(updated);
            await saveCustomMedications(updated);
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    // If custom medication, persist it to the list
    if (isCustom && customName.trim() && !isNameDuplicate(customName.trim())) {
      const updated = [...customMeds, customName.trim()];
      setCustomMeds(updated);
      await saveCustomMedications(updated);
    }

    const data: MedicationData = {
      name: medicationName,
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
      await scheduleMedicationReminder(hours, medicationName, state.profile?.name || "baby");
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  return (
    <ScreenContainer edges={["left", "right"]} className="px-4 pt-2">
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
          </View>

          {/* Date & Time */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
          <DateTimePicker
            value={eventDate}
            onChange={setEventDate}
            accentColor={colors.medication}
            label="Given at"
          />

          {/* Medication Picker */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Medication / Supplement</Text>

          {showPicker ? (
            <View style={{ gap: 12 }}>
              {/* Built-in presets */}
              {BUILT_IN_MEDICATIONS.map((group) => (
                <View key={group.category}>
                  <Text style={[styles.categoryLabel, { color: colors.foreground }]}>
                    {group.category}
                  </Text>
                  <View style={styles.presetGrid}>
                    {group.items.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => handleSelectPreset(item)}
                        style={({ pressed }) => [
                          styles.presetChip,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[styles.presetChipText, { color: colors.foreground }]}>
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {/* User's Custom Medications */}
              {!loadingCustom && customMeds.length > 0 && (
                <View>
                  <Text style={[styles.categoryLabel, { color: colors.medication }]}>
                    Your Medications
                  </Text>
                  <View style={styles.presetGrid}>
                    {customMeds.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => handleSelectPreset(item)}
                        onLongPress={() => handleDeleteCustomMed(item)}
                        style={({ pressed }) => [
                          styles.presetChip,
                          {
                            backgroundColor: colors.medication + "10",
                            borderColor: colors.medication + "40",
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[styles.presetChipText, { color: colors.foreground }]}>
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6, fontStyle: "italic" }}>
                    Long press to remove a custom medication
                  </Text>
                </View>
              )}

              {/* Other (custom) */}
              <Pressable
                onPress={handleSelectCustom}
                style={({ pressed }) => [
                  styles.customBtn,
                  {
                    backgroundColor: colors.medication + "15",
                    borderColor: colors.medication + "40",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="pencil" size={16} color={colors.medication} />
                <Text style={[styles.customBtnText, { color: colors.medication }]}>
                  Other (custom)
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {/* Selected medication display */}
              <View style={[styles.selectedRow, { backgroundColor: colors.surface, borderColor: colors.medication + "40" }]}>
                <View style={{ flex: 1 }}>
                  {isCustom ? (
                    <TextInput
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="Enter medication name..."
                      placeholderTextColor={colors.muted}
                      autoFocus
                      returnKeyType="done"
                      style={[styles.customInput, { color: colors.foreground }]}
                    />
                  ) : (
                    <Text style={[styles.selectedName, { color: colors.foreground }]}>
                      {selectedPreset}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={handleChangeMedication}
                  style={({ pressed }) => [
                    styles.changeBtn,
                    { backgroundColor: colors.medication + "20" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: colors.medication, fontSize: 13, fontWeight: "600" }}>
                    Change
                  </Text>
                </Pressable>
              </View>
              {isCustom && customName.trim().length > 0 && !isNameDuplicate(customName.trim()) && (
                <Text style={{ color: colors.medication, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>
                  This medication will be saved to your list for future use.
                </Text>
              )}
            </View>
          )}

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
    paddingVertical: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  customBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  customBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: "600",
  },
  customInput: {
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
