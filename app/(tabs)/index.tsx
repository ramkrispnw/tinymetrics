import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Modal,
  Platform,
  Image,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/lib/store";
import {
  isToday,
  formatTime,
  formatDuration,
  mlToOz,
  calculateAge,
  type BabyEvent,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
  type PumpData,
} from "@/lib/store";
import { LogFeedSheet } from "@/components/log-feed-sheet";
import { LogSleepSheet } from "@/components/log-sleep-sheet";
import { LogDiaperSheet } from "@/components/log-diaper-sheet";
import { LogObservationSheet } from "@/components/log-observation-sheet";
import { SetupProfileSheet } from "@/components/setup-profile-sheet";
import { SettingsSheet } from "@/components/settings-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { LogGrowthSheet } from "@/components/log-growth-sheet";
import { ImportLogsSheet } from "@/components/import-logs-sheet";
import { WeeklyDigestSheet } from "@/components/weekly-digest-sheet";
import { LogPumpSheet } from "@/components/log-pump-sheet";

type SheetType = "feed" | "sleep" | "diaper" | "observation" | "pump" | "profile" | "settings" | "share" | "growth" | "import" | "digest" | null;

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HomeScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { state, syncToCloud, loadFromCloud } = useStore();
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const hasSyncedRef = useRef(false);

  // Auto-sync on app load when authenticated
  // Small delay ensures auth token is fully ready after login
  useEffect(() => {
    if (isAuthenticated && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      const timer = setTimeout(() => {
        // Pull cloud data first (to get partner's events), then push local
        loadFromCloud()
          .then(() => syncToCloud())
          .catch(() => {
            // If pull fails, try push anyway
            syncToCloud().catch(() => {});
          });
      }, 500); // Small delay for auth token readiness
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, syncToCloud, loadFromCloud]);

  const todayEvents = useMemo(
    () => state.events.filter((e) => isToday(e.timestamp)),
    [state.events]
  );

  const todayFeedMl = useMemo(() => {
    return todayEvents
      .filter((e) => e.type === "feed")
      .reduce((sum, e) => sum + ((e.data as FeedData).amountMl || 0), 0);
  }, [todayEvents]);

  const todayDiapers = useMemo(() => {
    const diapers = todayEvents.filter((e) => e.type === "diaper");
    let pee = 0;
    let poo = 0;
    diapers.forEach((e) => {
      const d = e.data as DiaperData;
      if (d.type === "pee") pee++;
      else if (d.type === "poo") poo++;
      else {
        pee++;
        poo++;
      }
    });
    return { pee, poo, total: diapers.length };
  }, [todayEvents]);

  const todaySleepMin = useMemo(() => {
    return todayEvents
      .filter((e) => e.type === "sleep")
      .reduce((sum, e) => sum + ((e.data as SleepData).durationMin || 0), 0);
  }, [todayEvents]);

  const todayPumpMl = useMemo(() => {
    return todayEvents
      .filter((e) => e.type === "pump")
      .reduce((sum, e) => sum + ((e.data as PumpData).amountMl || 0), 0);
  }, [todayEvents]);

  const recentEvents = useMemo(() => todayEvents.slice(0, 8), [todayEvents]);

  const ageInfo = useMemo(() => {
    if (!state.profile?.birthDate) return null;
    return calculateAge(state.profile.birthDate);
  }, [state.profile?.birthDate]);

  const profileSubtitle = useMemo(() => {
    if (!state.profile) return null;
    const parts: string[] = [];
    if (ageInfo) parts.push(ageInfo.label);
    if (state.profile.weight != null) {
      parts.push(`${state.profile.weight} ${state.profile.weightUnit || "kg"}`);
    }
    if (state.profile.height != null) {
      parts.push(`${state.profile.height} ${state.profile.heightUnit || "cm"}`);
    }
    return parts.join(" · ");
  }, [state.profile, ageInfo]);

  const displayAmount = useCallback(
    (ml: number) => {
      if (state.settings.units === "oz") return `${mlToOz(ml)} oz`;
      return `${ml} ml`;
    },
    [state.settings.units]
  );

  const getEventIcon = (type: string) => {
    switch (type) {
      case "feed": return "fork.knife" as const;
      case "sleep": return "moon.fill" as const;
      case "diaper": return "drop.fill" as const;
      case "observation": return "eye.fill" as const;
      case "pump": return "drop.triangle.fill" as const;
      default: return "info.circle.fill" as const;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "feed": return colors.feed;
      case "sleep": return colors.sleep;
      case "diaper": return colors.diaper;
      case "observation": return colors.observation;
      case "pump": return colors.pump;
      default: return colors.muted;
    }
  };

  const getEventSummary = (event: BabyEvent): string => {
    switch (event.type) {
      case "feed": {
        const d = event.data as FeedData;
        const amt = d.amountMl ? displayAmount(d.amountMl) : "";
        const dur = d.durationMin ? formatDuration(d.durationMin) : "";
        const method = d.method === "bottle" ? "Bottle" : d.method === "solid" ? "Solid" : "Breast";
        return [method, amt, dur].filter(Boolean).join(" · ");
      }
      case "sleep": {
        const d = event.data as SleepData;
        return d.durationMin ? formatDuration(d.durationMin) : "In progress...";
      }
      case "diaper": {
        const d = event.data as DiaperData;
        return d.type === "both" ? "Pee & Poo" : d.type === "pee" ? "Pee" : "Poo";
      }
      case "observation": {
        const d = event.data as ObservationData;
        return `${d.category.replace("_", " ")} · ${d.severity}`;
      }
      case "pump": {
        const d = event.data as PumpData;
        const amt = d.amountMl ? displayAmount(d.amountMl) : "";
        const dur = d.durationMin ? formatDuration(d.durationMin) : "";
        const sideLabel = d.side === "both" ? "Both sides" : d.side === "left" ? "Left" : "Right";
        return [sideLabel, amt, dur].filter(Boolean).join(" · ");
      }
      default:
        return "";
    }
  };

  const closeSheet = () => setActiveSheet(null);

  return (
    <ScreenContainer className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            {state.profile ? (
              <Pressable
                onPress={() => setActiveSheet("profile")}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12 }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.headerAvatar, { backgroundColor: colors.primary + "20" }]}>
                  {state.profile.photoUri ? (
                    <Image source={{ uri: state.profile.photoUri }} style={styles.headerAvatarImg} />
                  ) : (
                    <Text style={{ fontSize: 22 }}>👶</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-2xl font-bold text-foreground">
                      {state.profile.name}
                    </Text>
                    <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                  </View>
                  {profileSubtitle && (
                    <Text className="text-sm text-muted mt-0.5">{profileSubtitle}</Text>
                  )}
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setActiveSheet("profile")}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text className="text-2xl font-bold text-foreground">
                  Welcome!
                </Text>
                <Text className="text-sm text-primary mt-0.5">
                  Tap to set up baby profile
                </Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setActiveSheet("settings")}
            style={({ pressed }) => [
              styles.settingsBtn,
              { backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="gearshape.fill" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {/* Last Synced Indicator */}
        {isAuthenticated && state.lastSyncedAt && (
          <View style={[styles.syncRow, { backgroundColor: colors.success + "10" }]}>
            <IconSymbol name="arrow.clockwise" size={12} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 11, fontWeight: "500" }}>
              Synced {formatRelativeTime(state.lastSyncedAt)}
            </Text>
          </View>
        )}

        {/* Summary Cards */}
        <View className="flex-row gap-2 mb-3">
          <View
            style={[styles.summaryCard, { backgroundColor: colors.feed + "15", borderColor: colors.feed + "30" }]}
          >
            <IconSymbol name="fork.knife" size={18} color={colors.feed} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {displayAmount(todayFeedMl)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Feed</Text>
          </View>
          <View
            style={[styles.summaryCard, { backgroundColor: colors.diaper + "15", borderColor: colors.diaper + "30" }]}
          >
            <IconSymbol name="drop.fill" size={18} color={colors.diaper} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {todayDiapers.pee}P / {todayDiapers.poo}💩
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Diapers</Text>
          </View>
          <View
            style={[styles.summaryCard, { backgroundColor: colors.sleep + "15", borderColor: colors.sleep + "30" }]}
          >
            <IconSymbol name="moon.fill" size={18} color={colors.sleep} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {formatDuration(todaySleepMin)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Sleep</Text>
          </View>
          <View
            style={[styles.summaryCard, { backgroundColor: colors.pump + "15", borderColor: colors.pump + "30" }]}
          >
            <IconSymbol name="drop.triangle.fill" size={18} color={colors.pump} />
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {displayAmount(todayPumpMl)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Pumped</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text className="text-lg font-semibold text-foreground mb-3">Log Event</Text>
        <View className="flex-row gap-3 mb-6">
          {[
            { type: "feed" as const, label: "Feed", icon: "fork.knife" as const, color: colors.feed },
            { type: "sleep" as const, label: "Sleep", icon: "moon.fill" as const, color: colors.sleep },
            { type: "diaper" as const, label: "Diaper", icon: "drop.fill" as const, color: colors.diaper },
            { type: "observation" as const, label: "Note", icon: "eye.fill" as const, color: colors.observation },
            { type: "pump" as const, label: "Pump", icon: "drop.triangle.fill" as const, color: colors.pump },
          ].map((action) => (
            <Pressable
              key={action.type}
              onPress={() => setActiveSheet(action.type)}
              style={({ pressed }) => [
                styles.quickAction,
                { backgroundColor: action.color + "15", borderColor: action.color + "30" },
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
            >
              <View
                style={[styles.quickActionIcon, { backgroundColor: action.color + "25" }]}
              >
                <IconSymbol name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Growth Tracking Button */}
        <Pressable
          onPress={() => setActiveSheet("growth")}
          style={({ pressed }) => [
            styles.growthBtn,
            { backgroundColor: colors.success + "12", borderColor: colors.success + "30" },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={{ fontSize: 20 }}>📏</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Log Growth</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Track weight & height over time</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

        {/* Import Logs Button */}
        <Pressable
          onPress={() => setActiveSheet("import")}
          style={({ pressed }) => [
            styles.growthBtn,
            { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30", marginTop: 8 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={{ fontSize: 20 }}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Import Prior Logs</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Upload PDF/notes for AI parsing</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>

        {/* Recent Activity */}
        <Text className="text-lg font-semibold text-foreground mb-3">Today's Activity</Text>
        {recentEvents.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              No events logged today.{"\n"}Tap a button above to start tracking!
            </Text>
          </View>
        ) : (
          recentEvents.map((event) => (
            <View
              key={event.id}
              style={[styles.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.type) + "20" }]}>
                <IconSymbol name={getEventIcon(event.type)} size={18} color={getEventColor(event.type)} />
              </View>
              <View style={styles.eventContent}>
                <Text style={[styles.eventTitle, { color: colors.foreground }]}>
                  {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                </Text>
                <Text style={[styles.eventSummary, { color: colors.muted }]}>
                  {getEventSummary(event)}
                </Text>
              </View>
              <Text style={[styles.eventTime, { color: colors.muted }]}>
                {formatTime(event.timestamp)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={activeSheet === "feed"} animationType="slide" presentationStyle="pageSheet">
        <LogFeedSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "sleep"} animationType="slide" presentationStyle="pageSheet">
        <LogSleepSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "diaper"} animationType="slide" presentationStyle="pageSheet">
        <LogDiaperSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "observation"} animationType="slide" presentationStyle="pageSheet">
        <LogObservationSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "profile"} animationType="slide" presentationStyle="pageSheet">
        <SetupProfileSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "settings"} animationType="slide" presentationStyle="pageSheet">
        <SettingsSheet onClose={closeSheet} onOpenShare={() => setActiveSheet("share")} onEditProfile={() => setActiveSheet("profile")} onOpenDigest={() => setActiveSheet("digest")} />
      </Modal>
      <Modal visible={activeSheet === "share"} animationType="slide" presentationStyle="pageSheet">
        <ShareSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "growth"} animationType="slide" presentationStyle="pageSheet">
        <LogGrowthSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "import"} animationType="slide" presentationStyle="pageSheet">
        <ImportLogsSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "digest"} animationType="slide" presentationStyle="pageSheet">
        <WeeklyDigestSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "pump"} animationType="slide" presentationStyle="pageSheet">
        <LogPumpSheet onClose={closeSheet} />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  eventSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  growthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
});
