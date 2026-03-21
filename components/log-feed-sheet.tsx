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
import type { FeedMethod, FeedData } from "@/lib/store";
import * as Haptics from "expo-haptics";
import { pickImage, uploadPhotoToCloud } from "@/lib/image-utils";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { DateTimePicker } from "@/components/date-time-picker";

interface Props {
  onClose: () => void;
}

export function LogFeedSheet({ onClose }: Props) {
  const colors = useColors();
  const { addEvent, state } = useStore();
  const [method, setMethod] = useState<FeedMethod>("bottle");
  const [amount, setAmount] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const analyzeBottle = trpc.ai.analyzeBottle.useMutation();

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

    const data: FeedData = {
      method,
      amountMl,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
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
      type: "feed",
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

  const methods: { key: FeedMethod; label: string }[] = [
    { key: "bottle", label: "Bottle" },
    { key: "breast_left", label: "Left" },
    { key: "breast_right", label: "Right" },
    { key: "solid", label: "Solid" },
  ];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Log Feed</Text>
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
          accentColor={colors.feed}
          label="Event time"
        />

        {/* Method Selector */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Type</Text>
        <View style={styles.methodRow}>
          {methods.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => {
                setMethod(m.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.methodBtn,
                {
                  backgroundColor: method === m.key ? colors.feed + "20" : colors.surface,
                  borderColor: method === m.key ? colors.feed : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: method === m.key ? colors.feed : colors.foreground,
                  fontWeight: method === m.key ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        {(method === "bottle" || method === "solid") && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              Amount ({state.settings.units})
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
              <Pressable
                onPress={async () => {
                  const img = await pickImage("camera");
                  if (img) {
                    setImageUri(img.uri);
                    setImageBase64(img.base64);
                    setImageMime(img.mimeType);
                    setAnalyzing(true);
                    try {
                      const result = await analyzeBottle.mutateAsync({
                        imageBase64: img.base64,
                        mimeType: img.mimeType,
                      });
                      if (result.amountMl > 0) {
                        const displayVal = state.settings.units === "oz"
                          ? (result.amountMl * 0.033814).toFixed(1)
                          : result.amountMl.toString();
                        setAmount(displayVal);
                      }
                    } catch (e) {
                      // silently fail
                    }
                    setAnalyzing(false);
                  }
                }}
                disabled={analyzing}
                style={({ pressed }) => [
                  styles.cameraBtn,
                  { backgroundColor: colors.feed + "15" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="camera.fill" size={20} color={colors.feed} />
                <Text style={{ color: colors.feed, fontSize: 12, fontWeight: "600" }}>
                  {analyzing ? "..." : "Scan"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Timer for breast */}
        {(method === "breast_left" || method === "breast_right") && (
          <>
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
                    backgroundColor: timerRunning ? colors.error + "20" : colors.feed + "20",
                    borderColor: timerRunning ? colors.error : colors.feed,
                  },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol
                  name={timerRunning ? "stop.fill" : "play.fill"}
                  size={20}
                  color={timerRunning ? colors.error : colors.feed}
                />
                <Text
                  style={{
                    color: timerRunning ? colors.error : colors.feed,
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
                placeholder="e.g. 15"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                returnKeyType="done"
                style={[styles.textInput, { color: colors.foreground }]}
              />
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
  methodRow: {
    flexDirection: "row",
    gap: 8,
  },
  methodBtn: {
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
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
