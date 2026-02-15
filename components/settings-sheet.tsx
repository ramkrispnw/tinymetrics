import { useState } from "react";
import {
  Text,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function SettingsSheet({ onClose }: Props) {
  const colors = useColors();
  const { state, updateSettings } = useStore();

  const toggleUnits = () => {
    const newUnits = state.settings.units === "ml" ? "oz" : "ml";
    updateSettings({ units: newUnits });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const togglePremium = () => {
    updateSettings({ isPremium: !state.settings.isPremium });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        {/* Baby Profile */}
        {state.profile && (
          <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary + "20" }]}>
              <Text style={{ fontSize: 28 }}>👶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>
                {state.profile.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Born {state.profile.birthDate}
              </Text>
            </View>
          </View>
        )}

        {/* Units */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Preferences</Text>
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Volume Units</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Currently: {state.settings.units === "ml" ? "Milliliters (ml)" : "Ounces (oz)"}
            </Text>
          </View>
          <Pressable
            onPress={toggleUnits}
            style={({ pressed }) => [
              styles.unitToggle,
              { backgroundColor: colors.primary + "15", borderColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
              {state.settings.units.toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {/* Premium */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Subscription</Text>
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <IconSymbol name="crown.fill" size={18} color={colors.warning} />
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Premium</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              {state.settings.isPremium
                ? "AI features unlocked"
                : "Unlock AI summaries, Q&A, and image analysis"}
            </Text>
          </View>
          <Switch
            value={state.settings.isPremium}
            onValueChange={togglePremium}
            trackColor={{ false: colors.border, true: colors.primary + "60" }}
            thumbColor={state.settings.isPremium ? colors.primary : colors.muted}
          />
        </View>

        {/* Stats */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Data</Text>
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Total Events</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {state.events.length} events logged
            </Text>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
            Baby Tracker v1.0.0
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
            All data stored locally on your device
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
  title: { fontSize: 17, fontWeight: "700" },
  doneText: { fontSize: 16, fontWeight: "700" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  unitToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  appInfo: {
    paddingVertical: 32,
  },
});
