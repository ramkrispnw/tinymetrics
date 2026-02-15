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
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function SetupProfileSheet({ onClose }: Props) {
  const colors = useColors();
  const { state, updateProfile } = useStore();
  const [name, setName] = useState(state.profile?.name || "");
  const [birthDate, setBirthDate] = useState(state.profile?.birthDate || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateProfile({
      name: name.trim(),
      birthDate: birthDate || new Date().toISOString().split("T")[0],
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

        {/* Avatar Placeholder */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ fontSize: 40 }}>👶</Text>
          </View>
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
            autoFocus
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
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
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
});
