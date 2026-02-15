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
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import type { WeightUnit, HeightUnit } from "@/lib/store";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function LogGrowthSheet({ onClose }: Props) {
  const colors = useColors();
  const { state, addGrowthEntry, deleteGrowthEntry } = useStore();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(state.profile?.weightUnit || "kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(state.profile?.heightUnit || "cm");
  const [saving, setSaving] = useState(false);

  const canSave = weight.trim() || height.trim();

  const handleDelete = (id: string, date: string) => {
    const doDelete = () => {
      deleteGrowthEntry(id);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete growth entry from ${date}?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete Entry",
        `Delete growth entry from ${date}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await addGrowthEntry({
      date: date || today,
      weight: weight ? parseFloat(weight) : undefined,
      weightUnit,
      height: height ? parseFloat(height) : undefined,
      heightUnit,
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
          <Text style={[styles.title, { color: colors.foreground }]}>Log Growth</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !canSave}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: canSave ? colors.primary : colors.muted },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {/* Icon */}
        <View style={styles.iconSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.success + "20" }]}>
            <Text style={{ fontSize: 36 }}>📏</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
            Track weight and height over time
          </Text>
        </View>

        {/* Date */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Date</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        {/* Weight */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Weight</Text>
        <View style={styles.measureRow}>
          <View style={[styles.measureInput, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder={weightUnit === "kg" ? "e.g. 5.2" : "e.g. 11.5"}
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
                    backgroundColor: weightUnit === u ? colors.success : colors.surface,
                    borderColor: weightUnit === u ? colors.success : colors.border,
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
              placeholder={heightUnit === "cm" ? "e.g. 55" : "e.g. 21.5"}
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
                    backgroundColor: heightUnit === u ? colors.success : colors.surface,
                    borderColor: heightUnit === u ? colors.success : colors.border,
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

        {/* Recent entries */}
        {state.growthHistory.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Recent Entries</Text>
            {state.growthHistory.slice(0, 10).map((entry) => (
              <View
                key={entry.id}
                style={[styles.entryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                    {entry.date}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
                    {entry.weight != null && (
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        {entry.weight} {entry.weightUnit || "kg"}
                      </Text>
                    )}
                    {entry.height != null && (
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        {entry.height} {entry.heightUnit || "cm"}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => handleDelete(entry.id, entry.date)}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { backgroundColor: colors.error + "15" },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
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
  iconSection: {
    alignItems: "center",
    paddingVertical: 20,
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
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
});
