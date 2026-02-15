import { useState } from "react";
import {
  Text,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore, calculateAge } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
  onOpenShare: () => void;
  onEditProfile: () => void;
}

export function SettingsSheet({ onClose, onOpenShare, onEditProfile }: Props) {
  const colors = useColors();
  const { state, updateSettings } = useStore();
  const { user, isAuthenticated, loading: authLoading, logout, refresh } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const toggleUnits = () => {
    const newUnits = state.settings.units === "ml" ? "oz" : "ml";
    updateSettings({ units: newUnits });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const togglePremium = () => {
    updateSettings({ isPremium: !state.settings.isPremium });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLogin = async () => {
    setLoggingIn(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await startOAuthLogin();
    } catch (e) {
      console.error("[Settings] Login error:", e);
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await logout();
    } catch (e) {
      console.error("[Settings] Logout error:", e);
    }
    setLoggingOut(false);
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

        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Account</Text>
        {authLoading ? (
          <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 10 }}>Loading...</Text>
          </View>
        ) : isAuthenticated && user ? (
          <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.accountAvatar, { backgroundColor: colors.primary + "20" }]}>
              <IconSymbol name="person.fill" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountName, { color: colors.foreground }]}>
                {user.name || "User"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {user.email || "Signed in with Google"}
              </Text>
            </View>
            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.logoutBtn,
                { backgroundColor: colors.error + "15", borderColor: colors.error + "40" },
                pressed && { opacity: 0.7 },
              ]}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>Sign Out</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleLogin}
            disabled={loggingIn}
            style={({ pressed }) => [
              styles.loginBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.googleIcon, { backgroundColor: "#FFFFFF" }]}>
              <Text style={{ fontSize: 18 }}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>
                Sign in with Google
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                Sync your data across devices
              </Text>
            </View>
            {loggingIn ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            )}
          </Pressable>
        )}

        {/* Baby Profile */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Baby Profile</Text>
        {state.profile ? (
          <View style={[styles.profileCardFull, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Top row: avatar + name + edit button */}
            <View style={styles.profileTopRow}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={{ fontSize: 28 }}>👶</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {state.profile.name}
                </Text>
                {state.profile.birthDate && (() => {
                  const age = calculateAge(state.profile!.birthDate);
                  return (
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                      {age.label}
                    </Text>
                  );
                })()}
              </View>
              <Pressable
                onPress={onEditProfile}
                style={({ pressed }) => [
                  styles.editBtn,
                  { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Edit</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Profile details grid */}
            <View style={styles.profileGrid}>
              <View style={styles.profileDetailItem}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>Date of Birth</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {state.profile.birthDate || "Not set"}
                </Text>
              </View>
              <View style={styles.profileDetailItem}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>Weight</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {state.profile.weight != null
                    ? `${state.profile.weight} ${state.profile.weightUnit || "kg"}`
                    : "Not set"}
                </Text>
              </View>
              <View style={styles.profileDetailItem}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>Height</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {state.profile.height != null
                    ? `${state.profile.height} ${state.profile.heightUnit || "cm"}`
                    : "Not set"}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onEditProfile}
            style={({ pressed }) => [
              styles.setupProfileBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary + "20" }]}>
              <Text style={{ fontSize: 28 }}>👶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Set Up Baby Profile</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                Add your baby's name, DOB, weight, and height
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
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

        {/* Partner Sharing */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Partner Sharing</Text>
        <Pressable
          onPress={onOpenShare}
          style={({ pressed }) => [
            styles.settingRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={[styles.shareIcon, { backgroundColor: colors.primary + "15" }]}>
            <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Share with Partner</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              Invite your partner to track together
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

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
            TinyMetrics v1.0.0
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
            {isAuthenticated ? "Data synced to your account" : "All data stored locally on your device"}
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    fontSize: 16,
    fontWeight: "700",
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
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
  shareIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCardFull: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  profileDetailItem: {
    minWidth: "30%" as any,
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  setupProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  appInfo: {
    paddingVertical: 32,
  },
});
