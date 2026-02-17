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
  Image,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { WeightUnit, HeightUnit } from "@/lib/store";
import { calculateAge } from "@/lib/store";
import { pickImage } from "@/lib/image-utils";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function SetupProfileSheet({ onClose }: Props) {
  const colors = useColors();
  const { state, updateProfile } = useStore();
  const [name, setName] = useState(state.profile?.name || "");
  const [birthDate, setBirthDate] = useState(state.profile?.birthDate || "");
  const [weight, setWeight] = useState(state.profile?.weight?.toString() || "");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(state.profile?.weightUnit || "kg");
  const [height, setHeight] = useState(state.profile?.height?.toString() || "");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(state.profile?.heightUnit || "cm");
  const [photoUri, setPhotoUri] = useState(state.profile?.photoUri || "");
  const [sex, setSex] = useState<"boy" | "girl" | undefined>(state.profile?.sex);
  const [saving, setSaving] = useState(false);

  const parsedBirthDate = birthDate.match(/^\d{4}-\d{2}-\d{2}$/) ? birthDate : null;
  const ageInfo = parsedBirthDate ? calculateAge(parsedBirthDate) : null;

  const handlePickPhoto = async (source: "camera" | "gallery") => {
    try {
      const result = await pickImage(source);
      if (result) {
        setPhotoUri(result.uri);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.error("Photo pick error:", e);
    }
  };

  const showPhotoOptions = () => {
    if (Platform.OS === "web") {
      handlePickPhoto("gallery");
      return;
    }
    Alert.alert("Baby Photo", "Choose a photo source", [
      { text: "Camera", onPress: () => handlePickPhoto("camera") },
      { text: "Photo Library", onPress: () => handlePickPhoto("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateProfile({
      name: name.trim(),
      birthDate: birthDate || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
      sex,
      weight: weight ? parseFloat(weight) : undefined,
      weightUnit,
      height: height ? parseFloat(height) : undefined,
      heightUnit,
      photoUri: photoUri || undefined,
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    onClose();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Baby Profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !name.trim()}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: name.trim() ? colors.primary : colors.muted },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {/* Avatar with Photo Upload */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={showPhotoOptions}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={{ fontSize: 40 }}>👶</Text>
              )}
            </View>
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              <IconSymbol name="camera.fill" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            Tap to add photo
          </Text>
          {ageInfo && (
            <View style={[styles.ageBadge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
                {ageInfo.label}
              </Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Baby's Name</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Emma"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[styles.textInput, { color: colors.foreground }]}
            autoFocus={!state.profile}
          />
        </View>

        {/* Birth Date */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Date of Birth</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          Format: YYYY-MM-DD (e.g. 2025-12-15)
        </Text>

        {/* Sex */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Sex</Text>
        <View style={styles.unitToggle}>
          {(["boy", "girl"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setSex(sex === s ? undefined : s);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.unitBtn,
                {
                  backgroundColor: sex === s ? colors.primary : colors.surface,
                  borderColor: sex === s ? colors.primary : colors.border,
                  flex: 1,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: sex === s ? "#fff" : colors.foreground,
                  fontWeight: sex === s ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {s === "boy" ? "👦 Boy" : "👧 Girl"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Weight */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Weight</Text>
        <View style={styles.measureRow}>
          <View style={[styles.measureInput, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder={weightUnit === "kg" ? "e.g. 4.5" : "e.g. 9.9"}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={[styles.textInput, { color: colors.foreground }]}
            />
          </View>
          <View style={styles.unitToggle}>
            {(["kg", "lbs"] as WeightUnit[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => {
                  setWeightUnit(u);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.unitBtn,
                  {
                    backgroundColor: weightUnit === u ? colors.primary : colors.surface,
                    borderColor: weightUnit === u ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={{
                    color: weightUnit === u ? "#fff" : colors.foreground,
                    fontWeight: weightUnit === u ? "700" : "500",
                    fontSize: 14,
                  }}
                >
                  {u}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Height */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Height</Text>
        <View style={styles.measureRow}>
          <View style={[styles.measureInput, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <TextInput
              value={height}
              onChangeText={setHeight}
              placeholder={heightUnit === "cm" ? "e.g. 52" : "e.g. 20.5"}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={[styles.textInput, { color: colors.foreground }]}
            />
          </View>
          <View style={styles.unitToggle}>
            {(["cm", "in"] as HeightUnit[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => {
                  setHeightUnit(u);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.unitBtn,
                  {
                    backgroundColor: heightUnit === u ? colors.primary : colors.surface,
                    borderColor: heightUnit === u ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={{
                    color: heightUnit === u ? "#fff" : colors.foreground,
                    fontWeight: heightUnit === u ? "700" : "500",
                    fontSize: 14,
                  }}
                >
                  {u}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            Weight and height help the AI assistant provide age- and size-appropriate advice for your baby.
          </Text>
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
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  ageBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 14,
  },
  measureRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  measureInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  unitToggle: {
    flexDirection: "row",
    gap: 4,
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoCard: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
