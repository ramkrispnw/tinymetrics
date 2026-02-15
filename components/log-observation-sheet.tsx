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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { ObservationCategory, Severity, ObservationData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { pickImage } from "@/lib/image-utils";
import { trpc } from "@/lib/trpc";
import { DateTimePicker } from "@/components/date-time-picker";

interface Props {
  onClose: () => void;
}

export function LogObservationSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent } = useStore();
  const [category, setCategory] = useState<ObservationCategory>("rash");
  const [severity, setSeverity] = useState<Severity>("mild");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const analyzePhoto = trpc.ai.analyzePhoto.useMutation();

  const handleSave = async () => {
    setSaving(true);
    const data: ObservationData = {
      category,
      severity,
      description: description || undefined,
      notes: notes || undefined,
    };

    await addEvent({
      type: "observation",
      timestamp: eventDate.toISOString(),
      data,
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const categories: { key: ObservationCategory; label: string; icon: string }[] = [
    { key: "rash", label: "Rash", icon: "🔴" },
    { key: "fast_breathing", label: "Fast Breathing", icon: "💨" },
    { key: "fever", label: "Fever", icon: "🌡️" },
    { key: "vomiting", label: "Vomiting", icon: "🤢" },
    { key: "cough", label: "Cough", icon: "😷" },
    { key: "other", label: "Other", icon: "📝" },
  ];

  const severities: { key: Severity; label: string; color: string }[] = [
    { key: "mild", label: "Mild", color: colors.success },
    { key: "moderate", label: "Moderate", color: colors.warning },
    { key: "severe", label: "Severe", color: colors.error },
  ];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Log Observation</Text>
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

        {/* Date & Time */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>When</Text>
        <DateTimePicker
          value={eventDate}
          onChange={setEventDate}
          accentColor={colors.observation}
          label="Event time"
        />

        {/* Category */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => {
                setCategory(cat.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.categoryBtn,
                {
                  backgroundColor: category === cat.key ? colors.observation + "20" : colors.surface,
                  borderColor: category === cat.key ? colors.observation : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
              <Text
                style={{
                  color: category === cat.key ? colors.observation : colors.foreground,
                  fontWeight: category === cat.key ? "700" : "500",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Severity */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Severity</Text>
        <View style={styles.severityRow}>
          {severities.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => {
                setSeverity(s.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.severityBtn,
                {
                  backgroundColor: severity === s.key ? s.color + "20" : colors.surface,
                  borderColor: severity === s.key ? s.color : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: severity === s.key ? s.color : colors.foreground,
                  fontWeight: severity === s.key ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Camera Option */}
        <Pressable
          onPress={async () => {
            const img = await pickImage("camera");
            if (img) {
              setImageUri(img.uri);
              setAnalyzing(true);
              try {
                const result = await analyzePhoto.mutateAsync({
                  imageBase64: img.base64,
                  mimeType: img.mimeType,
                  question: `This is an observation about a baby. The category is ${category}. Please analyze and provide insights.`,
                });
                setAiInsight(result.answer);
              } catch (e) {
                // silently fail
              }
              setAnalyzing(false);
            }
          }}
          disabled={analyzing}
          style={({ pressed }) => [
            styles.cameraRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="camera.fill" size={20} color={colors.observation} />
          <Text style={{ color: colors.observation, fontWeight: "600", fontSize: 15 }}>
            {analyzing ? "Analyzing..." : "Take a photo"}
          </Text>
          <View style={{ flex: 1 }} />
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

        {aiInsight && (
          <View style={[styles.insightCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13, marginBottom: 4 }}>AI Insight</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>{aiInsight}</Text>
          </View>
        )}

        {/* Description */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Description</Text>
        <View style={[styles.notesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what you observed..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            style={[styles.notesInput, { color: colors.foreground }]}
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
            numberOfLines={2}
            style={[styles.notesInput, { color: colors.foreground }]}
          />
        </View>
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
  saveText: { fontSize: 16, fontWeight: "700" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryBtn: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  cameraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
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
  insightCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
