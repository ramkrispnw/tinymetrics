import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  type BabyEvent,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
  type PumpData,
  type FormulaPrepData,
  type MedicationData,
  type PooSize,
  formatTime,
  formatDate,
} from "@/lib/store";
import { DateTimePicker } from "./date-time-picker";
import * as Haptics from "expo-haptics";

interface Props {
  visible: boolean;
  event: BabyEvent | null;
  onClose: () => void;
}

export function EditEventSheet({ visible, event, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateEvent } = useStore();
  const [timestamp, setTimestamp] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Feed fields
  const [feedMethod, setFeedMethod] = useState<"bottle" | "breast_left" | "breast_right" | "solid">("bottle");
  const [amountMl, setAmountMl] = useState("");
  const [feedDuration, setFeedDuration] = useState("");
  const [feedNotes, setFeedNotes] = useState("");

  // Sleep fields
  const [sleepStartTime, setSleepStartTime] = useState(new Date());
  const [sleepEndTime, setSleepEndTime] = useState(new Date());
  const [showSleepStartPicker, setShowSleepStartPicker] = useState(false);
  const [showSleepEndPicker, setShowSleepEndPicker] = useState(false);
  const [sleepNotes, setSleepNotes] = useState("");

  // Diaper fields
  const [diaperType, setDiaperType] = useState<"pee" | "poo" | "both">("pee");
  const [pooColor, setPooColor] = useState("");
  const [pooConsistency, setPooConsistency] = useState("");
  const [diaperNotes, setDiaperNotes] = useState("");

  // Observation fields
  const [obsCategory, setObsCategory] = useState("general");
  const [obsSeverity, setObsSeverity] = useState<"mild" | "moderate" | "severe">("mild");
  const [obsNotes, setObsNotes] = useState("");

  // Pump fields
  const [pumpAmountMl, setPumpAmountMl] = useState("");
  const [pumpSide, setPumpSide] = useState<"left" | "right" | "both">("both");
  const [pumpDuration, setPumpDuration] = useState("");
  const [pumpNotes, setPumpNotes] = useState("");

  // Poo size
  const [pooSize, setPooSize] = useState<PooSize | "">("")

  // Formula prep fields
  const [formulaAmountMl, setFormulaAmountMl] = useState("");
  const [formulaNotes, setFormulaNotes] = useState("");

  // Medication fields
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medNotes, setMedNotes] = useState("");

  useEffect(() => {
    if (!event) return;
    setTimestamp(new Date(event.timestamp));
    switch (event.type) {
      case "feed": {
        const d = event.data as FeedData;
        setFeedMethod(d.method || "bottle");
        setAmountMl(d.amountMl ? String(d.amountMl) : "");
        setFeedDuration(d.durationMin ? String(d.durationMin) : "");
        setFeedNotes(d.notes || "");
        break;
      }
      case "sleep": {
        const d = event.data as SleepData;
        const sStart = d.startTime ? new Date(d.startTime) : new Date(event.timestamp);
        setSleepStartTime(sStart);
        // Derive end time: prefer endTime, then durationMin, then startTime + 0
        if (d.endTime) {
          setSleepEndTime(new Date(d.endTime));
        } else if (d.durationMin && d.durationMin > 0) {
          setSleepEndTime(new Date(sStart.getTime() + d.durationMin * 60000));
        } else {
          setSleepEndTime(new Date(sStart.getTime()));
        }
        setSleepNotes(d.notes || "");
        break;
      }
      case "diaper": {
        const d = event.data as DiaperData;
        setDiaperType(d.type || "pee");
        setPooColor(d.pooColor || "");
        setPooConsistency(d.pooConsistency || "");
        setPooSize(d.pooSize || "");
        setDiaperNotes(d.notes || "");
        break;
      }
      case "observation": {
        const d = event.data as ObservationData;
        setObsCategory(d.category || "general");
        setObsSeverity(d.severity || "mild");
        setObsNotes(d.notes || "");
        break;
      }
      case "pump": {
        const d = event.data as PumpData;
        setPumpAmountMl(d.amountMl ? String(d.amountMl) : "");
        setPumpSide(d.side || "both");
        setPumpDuration(d.durationMin ? String(d.durationMin) : "");
        setPumpNotes(d.notes || "");
        break;
      }
      case "formula_prep": {
        const d = event.data as FormulaPrepData;
        setFormulaAmountMl(d.amountMl ? String(d.amountMl) : "");
        setFormulaNotes(d.notes || "");
        break;
      }
      case "medication": {
        const d = event.data as MedicationData;
        setMedName(d.name || "");
        setMedDosage(d.dosage || "");
        setMedFrequency(d.frequency || "");
        setMedNotes(d.notes || "");
        break;
      }
    }
  }, [event]);

  if (!event) return null;

  const handleSave = async () => {
    let data: any;
    switch (event.type) {
      case "feed":
        data = {
          ...(event.data as FeedData),
          method: feedMethod,
          amountMl: amountMl ? parseFloat(amountMl) : undefined,
          durationMin: feedDuration ? parseInt(feedDuration) : undefined,
          notes: feedNotes || undefined,
        };
        break;
      case "sleep": {
        const durationMin = Math.round((sleepEndTime.getTime() - sleepStartTime.getTime()) / 60000);
        data = {
          ...(event.data as SleepData),
          startTime: sleepStartTime.toISOString(),
          endTime: sleepEndTime.toISOString(),
          durationMin: durationMin > 0 ? durationMin : 0,
          notes: sleepNotes || undefined,
        };
        break;
      }
      case "diaper":
        data = {
          ...(event.data as DiaperData),
          type: diaperType,
          pooColor: pooColor || undefined,
          pooConsistency: pooConsistency || undefined,
          pooSize: pooSize || undefined,
          notes: diaperNotes || undefined,
        };
        break;
      case "observation":
        data = {
          ...(event.data as ObservationData),
          category: obsCategory,
          severity: obsSeverity,
          notes: obsNotes || undefined,
        };
        break;
      case "pump":
        data = {
          ...(event.data as PumpData),
          amountMl: pumpAmountMl ? parseFloat(pumpAmountMl) : undefined,
          side: pumpSide,
          durationMin: pumpDuration ? parseInt(pumpDuration) : undefined,
          notes: pumpNotes || undefined,
        };
        break;
      case "formula_prep":
        data = {
          amountMl: formulaAmountMl ? parseFloat(formulaAmountMl) : undefined,
          notes: formulaNotes || undefined,
        };
        break;
      case "medication":
        data = {
          name: medName,
          dosage: medDosage || undefined,
          frequency: medFrequency || undefined,
          notes: medNotes || undefined,
        };
        break;
    }
    await updateEvent(event.id, {
      timestamp: timestamp.toISOString(),
      data,
    });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const getTypeColor = () => {
    switch (event.type) {
      case "feed": return colors.feed;
      case "sleep": return colors.sleep;
      case "diaper": return colors.diaper;
      case "observation": return colors.observation;
      case "pump": return colors.pump;
      case "formula_prep": return (colors as any).formula || colors.warning;
      case "medication": return (colors as any).medication || colors.error;
      default: return colors.primary;
    }
  };

  const typeColor = getTypeColor();

  const feedMethods: { key: "bottle" | "breast_left" | "breast_right" | "solid"; label: string }[] = [
    { key: "bottle", label: "Bottle" },
    { key: "breast_left", label: "Breast L" },
    { key: "breast_right", label: "Breast R" },
    { key: "solid", label: "Solid" },
  ];

  const diaperTypes: { key: "pee" | "poo" | "both"; label: string }[] = [
    { key: "pee", label: "💧 Pee" },
    { key: "poo", label: "💩 Poo" },
    { key: "both", label: "Both" },
  ];

  const severities: { key: "mild" | "moderate" | "severe"; label: string }[] = [
    { key: "mild", label: "Mild" },
    { key: "moderate", label: "Moderate" },
    { key: "severe", label: "Severe" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: colors.background, paddingLeft: insets.left, paddingRight: insets.right }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelBtn, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Edit {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
          </Text>
          <Pressable onPress={handleSave} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.saveBtn, { color: typeColor }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Date/Time */}
          <Text style={[styles.label, { color: colors.muted }]}>WHEN</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[styles.dateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.dateText, { color: colors.foreground }]}>
              {formatDate(timestamp.toISOString())} at {formatTime(timestamp.toISOString())}
            </Text>
            <Text style={{ color: typeColor, fontSize: 13 }}>Change</Text>
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={timestamp}
              onChange={(d) => {
                setTimestamp(d);
                setShowDatePicker(false);
              }}
              accentColor={typeColor}
            />
          )}

          {/* Feed fields */}
          {event.type === "feed" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>METHOD</Text>
              <View style={styles.toggleRow}>
                {feedMethods.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setFeedMethod(m.key)}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: feedMethod === m.key ? typeColor : colors.surface,
                        borderColor: feedMethod === m.key ? typeColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: feedMethod === m.key ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.muted }]}>AMOUNT (ML)</Text>
              <TextInput
                value={amountMl}
                onChangeText={setAmountMl}
                keyboardType="numeric"
                placeholder="e.g. 120"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>DURATION (MIN)</Text>
              <TextInput
                value={feedDuration}
                onChangeText={setFeedDuration}
                keyboardType="numeric"
                placeholder="e.g. 15"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={feedNotes}
                onChangeText={setFeedNotes}
                multiline
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Sleep fields */}
          {event.type === "sleep" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>START TIME</Text>
              <Pressable
                onPress={() => setShowSleepStartPicker(true)}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: "center" }]}
              >
                <Text style={{ color: colors.foreground }}>{formatDate(sleepStartTime.toISOString())} {formatTime(sleepStartTime.toISOString())}</Text>
              </Pressable>
              {showSleepStartPicker && (
                <DateTimePicker
                  value={sleepStartTime}
                  onChange={(d) => { setSleepStartTime(d); setShowSleepStartPicker(false); }}
                />
              )}

              <Text style={[styles.label, { color: colors.muted }]}>END TIME</Text>
              <Pressable
                onPress={() => setShowSleepEndPicker(true)}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: "center" }]}
              >
                <Text style={{ color: colors.foreground }}>{formatDate(sleepEndTime.toISOString())} {formatTime(sleepEndTime.toISOString())}</Text>
              </Pressable>
              {showSleepEndPicker && (
                <DateTimePicker
                  value={sleepEndTime}
                  onChange={(d) => { setSleepEndTime(d); setShowSleepEndPicker(false); }}
                />
              )}

              {sleepStartTime < sleepEndTime && (
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
                  Duration: {Math.round((sleepEndTime.getTime() - sleepStartTime.getTime()) / 60000)} min
                </Text>
              )}
              {sleepStartTime >= sleepEndTime && (
                <Text style={{ color: colors.error, fontSize: 13, marginBottom: 8 }}>End time must be after start time</Text>
              )}

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={sleepNotes}
                onChangeText={setSleepNotes}
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                multiline
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Diaper fields */}
          {event.type === "diaper" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>TYPE</Text>
              <View style={styles.toggleRow}>
                {diaperTypes.map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => setDiaperType(t.key)}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: diaperType === t.key ? typeColor : colors.surface,
                        borderColor: diaperType === t.key ? typeColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: diaperType === t.key ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {(diaperType === "poo" || diaperType === "both") && (
                <>
                  <Text style={[styles.label, { color: colors.muted }]}>POO SIZE</Text>
                  <View style={styles.toggleRow}>
                    {(["small", "medium", "large"] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setPooSize(s)}
                        style={[
                          styles.toggleBtn,
                          {
                            backgroundColor: pooSize === s ? typeColor : colors.surface,
                            borderColor: pooSize === s ? typeColor : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: pooSize === s ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.muted }]}>POO COLOR</Text>
                  <TextInput
                    value={pooColor}
                    onChangeText={setPooColor}
                    placeholder="e.g. yellow, green, brown"
                    placeholderTextColor={colors.muted + "80"}
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  />

                  <Text style={[styles.label, { color: colors.muted }]}>POO CONSISTENCY</Text>
                  <TextInput
                    value={pooConsistency}
                    onChangeText={setPooConsistency}
                    placeholder="e.g. soft, watery, firm"
                    placeholderTextColor={colors.muted + "80"}
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  />
                </>
              )}

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={diaperNotes}
                onChangeText={setDiaperNotes}
                multiline
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Pump fields */}
          {event.type === "pump" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>SIDE</Text>
              <View style={styles.toggleRow}>
                {(["left", "right", "both"] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setPumpSide(s)}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: pumpSide === s ? typeColor : colors.surface,
                        borderColor: pumpSide === s ? typeColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: pumpSide === s ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.muted }]}>AMOUNT (ML)</Text>
              <TextInput
                value={pumpAmountMl}
                onChangeText={setPumpAmountMl}
                keyboardType="numeric"
                placeholder="e.g. 120"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>DURATION (MIN)</Text>
              <TextInput
                value={pumpDuration}
                onChangeText={setPumpDuration}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={pumpNotes}
                onChangeText={setPumpNotes}
                multiline
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Formula Prep fields */}
          {event.type === "formula_prep" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>AMOUNT (ML)</Text>
              <TextInput
                value={formulaAmountMl}
                onChangeText={setFormulaAmountMl}
                keyboardType="numeric"
                placeholder="e.g. 120"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={formulaNotes}
                onChangeText={setFormulaNotes}
                multiline
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Medication fields */}
          {event.type === "medication" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>MEDICATION NAME</Text>
              <TextInput
                value={medName}
                onChangeText={setMedName}
                placeholder="e.g. Tylenol, Vitamin D"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>DOSAGE</Text>
              <TextInput
                value={medDosage}
                onChangeText={setMedDosage}
                placeholder="e.g. 2.5 ml, 1 drop"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>FREQUENCY</Text>
              <TextInput
                value={medFrequency}
                onChangeText={setMedFrequency}
                placeholder="e.g. every 6 hours, twice daily"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={medNotes}
                onChangeText={setMedNotes}
                multiline
                placeholder="Optional notes..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}

          {/* Observation fields */}
          {event.type === "observation" && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>CATEGORY</Text>
              <TextInput
                value={obsCategory}
                onChangeText={setObsCategory}
                placeholder="e.g. rash, breathing, fever"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.muted }]}>SEVERITY</Text>
              <View style={styles.toggleRow}>
                {severities.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => setObsSeverity(s.key)}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: obsSeverity === s.key ? typeColor : colors.surface,
                        borderColor: obsSeverity === s.key ? typeColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: obsSeverity === s.key ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.muted }]}>NOTES</Text>
              <TextInput
                value={obsNotes}
                onChangeText={setObsNotes}
                multiline
                placeholder="Describe what you observed..."
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  cancelBtn: {
    fontSize: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  dateBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 15,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
});
