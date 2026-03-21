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
import type { DiaperType, PooColor, PooConsistency, PooSize, DiaperData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { pickImage, uploadPhotoToCloud } from "@/lib/image-utils";
import { trpc } from "@/lib/trpc";
import { DateTimePicker } from "@/components/date-time-picker";

interface Props {
  onClose: () => void;
}

export function LogDiaperSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent } = useStore();
  const [type, setType] = useState<DiaperType>("pee");
  const [pooColor, setPooColor] = useState<PooColor | undefined>();
  const [pooConsistency, setPooConsistency] = useState<PooConsistency | undefined>();
  const [pooSize, setPooSize] = useState<PooSize | undefined>();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const analyzeDiaper = trpc.ai.analyzeDiaper.useMutation();

  const handleSave = async () => {
    setSaving(true);
    const data: DiaperData = {
      type,
      pooColor: type !== "pee" ? pooColor : undefined,
      pooConsistency: type !== "pee" ? pooConsistency : undefined,
      pooSize: type !== "pee" ? pooSize : undefined,
      notes: notes || undefined,
    };

    // Upload photo to cloud for cross-account access
    let cloudImageUrl: string | undefined;
    if (imageBase64 && imageUri && !imageUri.startsWith("http")) {
      const url = await uploadPhotoToCloud(imageBase64, imageMime);
      if (url) cloudImageUrl = url;
    } else if (imageUri?.startsWith("http")) {
      cloudImageUrl = imageUri;
    }

    await addEvent({
      type: "diaper",
      timestamp: eventDate.toISOString(),
      data,
      imageUrl: cloudImageUrl,
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  const diaperTypes: { key: DiaperType; label: string; emoji: string }[] = [
    { key: "pee", label: "Pee", emoji: "💧" },
    { key: "poo", label: "Poo", emoji: "💩" },
    { key: "both", label: "Both", emoji: "💧💩" },
  ];

  const pooColors: { key: PooColor; label: string; hex: string }[] = [
    { key: "yellow", label: "Yellow", hex: "#F59E0B" },
    { key: "green", label: "Green", hex: "#10B981" },
    { key: "brown", label: "Brown", hex: "#92400E" },
    { key: "black", label: "Black", hex: "#374151" },
    { key: "red", label: "Red", hex: "#EF4444" },
  ];

  const consistencies: { key: PooConsistency; label: string }[] = [
    { key: "liquid", label: "Liquid" },
    { key: "soft", label: "Soft" },
    { key: "firm", label: "Firm" },
    { key: "hard", label: "Hard" },
  ];

  const showPooDetails = type === "poo" || type === "both";

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
          <Text style={[styles.title, { color: colors.foreground }]}>Log Diaper</Text>
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
          accentColor={colors.diaper}
          label="Event time"
        />

        {/* Type Selector */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Type</Text>
        <View style={styles.typeRow}>
          {diaperTypes.map((dt) => (
            <Pressable
              key={dt.key}
              onPress={() => {
                setType(dt.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.typeBtn,
                {
                  backgroundColor: type === dt.key ? colors.diaper + "20" : colors.surface,
                  borderColor: type === dt.key ? colors.diaper : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontSize: 28 }}>{dt.emoji}</Text>
              <Text
                style={{
                  color: type === dt.key ? colors.diaper : colors.foreground,
                  fontWeight: type === dt.key ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {dt.label}
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
              setImageBase64(img.base64);
              setImageMime(img.mimeType);
              setAnalyzing(true);
              try {
                const result = await analyzeDiaper.mutateAsync({
                  imageBase64: img.base64,
                  mimeType: img.mimeType,
                });
                if (result.type) setType(result.type as DiaperType);
                if (result.pooColor) setPooColor(result.pooColor as PooColor);
                if (result.pooConsistency) setPooConsistency(result.pooConsistency as PooConsistency);
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
          <IconSymbol name="camera.fill" size={20} color={colors.diaper} />
          <Text style={{ color: colors.diaper, fontWeight: "600", fontSize: 15 }}>
            {analyzing ? "Analyzing..." : "Scan diaper with camera"}
          </Text>
          <View style={{ flex: 1 }} />
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

        {/* Poo Details */}
        {showPooDetails && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Color</Text>
            <View style={styles.colorRow}>
              {pooColors.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setPooColor(c.key);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.colorBtn,
                    {
                      borderColor: pooColor === c.key ? colors.diaper : colors.border,
                      borderWidth: pooColor === c.key ? 2 : 1,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                  <Text
                    style={{
                      color: pooColor === c.key ? colors.foreground : colors.muted,
                      fontSize: 11,
                      fontWeight: pooColor === c.key ? "600" : "400",
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Size</Text>
            <View style={styles.consistencyRow}>
              {(["small", "medium", "large"] as PooSize[]).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setPooSize(s);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.consistencyBtn,
                    {
                      backgroundColor: pooSize === s ? colors.diaper + "20" : colors.surface,
                      borderColor: pooSize === s ? colors.diaper : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>
                    {s === "small" ? "🟢" : s === "medium" ? "🟡" : "🟠"}
                  </Text>
                  <Text
                    style={{
                      color: pooSize === s ? colors.diaper : colors.foreground,
                      fontWeight: pooSize === s ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Consistency</Text>
            <View style={styles.consistencyRow}>
              {consistencies.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setPooConsistency(c.key);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.consistencyBtn,
                    {
                      backgroundColor: pooConsistency === c.key ? colors.diaper + "20" : colors.surface,
                      borderColor: pooConsistency === c.key ? colors.diaper : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={{
                      color: pooConsistency === c.key ? colors.diaper : colors.foreground,
                      fontWeight: pooConsistency === c.key ? "700" : "500",
                      fontSize: 13,
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

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
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
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
  colorRow: {
    flexDirection: "row",
    gap: 8,
  },
  colorBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  consistencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  consistencyBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
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
