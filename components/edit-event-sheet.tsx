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
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  type BabyEvent,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
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
  const { updateEvent } = useStore();
  const [timestamp, setTimestamp] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Feed fields
  const [feedMethod, setFeedMethod] = useState<"bottle" | "breast_left" | "breast_right" | "solid">("bottle");
  const [amountMl, setAmountMl] = useState("");
  const [feedDuration, setFeedDuration] = useState("");
  const [feedNotes, setFeedNotes] = useState("");

  // Sleep fields
  const [sleepDuration, setSleepDuration] = useState("");

  // Diaper fields
  const [diaperType, setDiaperType] = useState<"pee" | "poo" | "both">("pee");
  const [pooColor, setPooColor] = useState("");
  const [pooConsistency, setPooConsistency] = useState("");
  const [diaperNotes, setDiaperNotes] = useState("");

  // Observation fields
  const [obsCategory, setObsCategory] = useState("general");
  const [obsSeverity, setObsSeverity] = useState<"mild" | "moderate" | "severe">("mild");
  const [obsNotes, setObsNotes] = useState("");

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
        setSleepDuration(d.durationMin ? String(d.durationMin) : "");
        break;
      }
      case "diaper": {
        const d = event.data as DiaperData;
        setDiaperType(d.type || "pee");
        setPooColor(d.pooColor || "");
        setPooConsistency(d.pooConsistency || "");
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
      case "sleep":
        data = {
          ...(event.data as SleepData),
          durationMin: sleepDuration ? parseInt(sleepDuration) : undefined,
        };
        break;
      case "diaper":
        data = {
          ...(event.data as DiaperData),
          type: diaperType,
          pooColor: pooColor || undefined,
          pooConsistency: pooConsistency || undefined,
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
        style={[styles.container, { backgroundColor: colors.background }]}
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
              <Text style={[styles.label, { color: colors.muted }]}>DURATION (MINUTES)</Text>
              <TextInput
                value={sleepDuration}
                onChangeText={setSleepDuration}
                keyboardType="numeric"
                placeholder="e.g. 90"
                placeholderTextColor={colors.muted + "80"}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
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
