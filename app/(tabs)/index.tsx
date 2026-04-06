import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as Haptics from "expo-haptics";
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
  getSleepMinutesForDay,
  getTodayKey,
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
import { LogFormulaPrepSheet } from "@/components/log-formula-prep-sheet";
import { LogMedicationSheet } from "@/components/log-medication-sheet";
import { EditEventSheet } from "@/components/edit-event-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import type { FormulaPrepData, MedicationData } from "@/lib/store";
import { TodayProjectionCard } from "@/components/today-projection-card";
import { UndoSnackbar } from "@/components/undo-snackbar";
import { InlineAIInsight } from "@/components/inline-ai-insight";
import { GlassSurface } from "@/components/ui/glass-surface";
import { FLOATING_TAB_BAR_HEIGHT } from "@/constants/theme";

type SheetType = "feed" | "sleep" | "diaper" | "observation" | "pump" | "formula_prep" | "medication" | "profile" | "settings" | "share" | "growth" | "import" | "digest" | null;


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
  const { isAuthenticated, user } = useAuth();
  const { state, deleteEvent, deleteEvents, addEvent, syncToCloud, loadFromCloud, stopSleep, startSleep } = useStore();
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<BabyEvent | null>(null);
  const hasSyncedRef = useRef(false);
  const [syncing, setSyncing] = useState(false);

  // Undo-delete state: holds the event pending deletion during the grace period
  const [pendingDelete, setPendingDelete] = useState<BabyEvent | null>(null);

  // Session-level nudge dismiss — resets when app restarts
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const handleSyncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await syncToCloud();
      await loadFromCloud();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSyncing(false);
    }
  }, [syncing, syncToCloud, loadFromCloud]);

  // Batch select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectMode = () => {
    if (selectMode) setSelectedIds(new Set());
    setSelectMode(!selectMode);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectAllToday = () => {
    setSelectedIds(new Set(todayEvents.map((e) => e.id)));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBatchDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (Platform.OS === "web") {
      deleteEvents(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectMode(false);
      return;
    }
    Alert.alert(
      "Delete Events",
      `Are you sure you want to delete ${count} event${count !== 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteEvents(Array.from(selectedIds));
            setSelectedIds(new Set());
            setSelectMode(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

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

  // Periodic auto-sync every 30 seconds when authenticated
  // Ensures partner changes are picked up quickly
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      loadFromCloud().catch(() => {});
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, loadFromCloud]);

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
    const today = getTodayKey();
    // Include ALL sleep events (not just today's) to capture overnight sleep
    // that started yesterday but extends into today
    const allSleepEvents = state.events.filter((e) => e.type === "sleep");
    return allSleepEvents.reduce((sum, e) => sum + getSleepMinutesForDay(e, today), 0);
  }, [state.events]);

  const todayPumpMl = useMemo(() => {
    return todayEvents
      .filter((e) => e.type === "pump")
      .reduce((sum, e) => sum + ((e.data as PumpData).amountMl || 0), 0);
  }, [todayEvents]);

  // Priority: Alert (diaper gap) > Nudge (next feed) > null
  const homeInsight = useMemo(() => {
    const babyName = state.profile?.name || "Baby";

    // Alert: no diaper logged in 6+ hours
    const lastDiaper = state.events
      .filter((e) => e.type === "diaper")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (lastDiaper) {
      const hoursAgo = (Date.now() - new Date(lastDiaper.timestamp).getTime()) / 3600000;
      if (hoursAgo >= 6) {
        return {
          variant: "alert" as const,
          text: `No diaper logged in ${Math.floor(hoursAgo)}h — outside ${babyName}'s usual pattern.`,
          actionLabel: "Log diaper now" as const,
          actionSheet: "diaper" as SheetType,
        };
      }
    }

    // Nudge: next feed window approaching based on 7-day average interval
    if (!nudgeDismissed) {
      const feedEvents = state.events
        .filter((e) => e.type === "feed")
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const cutoff = Date.now() - 7 * 24 * 3600000;
      const recentFeeds = feedEvents.filter((e) => new Date(e.timestamp).getTime() > cutoff);
      if (recentFeeds.length >= 3) {
        let totalGap = 0;
        for (let i = 1; i < recentFeeds.length; i++) {
          totalGap += new Date(recentFeeds[i].timestamp).getTime() - new Date(recentFeeds[i - 1].timestamp).getTime();
        }
        const avgIntervalMs = totalGap / (recentFeeds.length - 1);
        const lastFeed = recentFeeds[recentFeeds.length - 1];
        const timeSinceLastMs = Date.now() - new Date(lastFeed.timestamp).getTime();
        const msUntilNext = avgIntervalMs - timeSinceLastMs;
        if (msUntilNext > 0 && msUntilNext <= 45 * 60000) {
          const minsUntil = Math.round(msUntilNext / 60000);
          return {
            variant: "nudge" as const,
            text: `Based on the last 7 days, ${babyName} typically feeds around this time. Next window in ~${minsUntil} min.`,
            actionLabel: "Log feed early" as const,
            actionSheet: "feed" as SheetType,
          };
        }
      }
    }

    return null;
  }, [state.events, state.profile, nudgeDismissed]);

  const handleDeleteEvent = useCallback((event: BabyEvent) => {
    // Optimistically remove from local state immediately for snappy UX
    // The actual server call is deferred until the snackbar timer expires
    deleteEvent(event.id); // removes from local state + queues server call internally
    // Cancel the pending server call by replacing with undo-able pending state
    setPendingDelete(event);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [deleteEvent]);

  // Show all today's events (no limit)

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
      case "formula_prep": return "flask.fill" as const;
      case "medication": return "pills.fill" as const;
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
      case "formula_prep": return colors.formula;
      case "medication": return colors.medication;
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
        const parts = [d.type === "both" ? "Pee & Poo" : d.type === "pee" ? "Pee" : "Poo"];
        if (d.pooSize) parts.push(d.pooSize);
        if (d.pooColor) parts.push(d.pooColor);
        if (d.pooConsistency) parts.push(d.pooConsistency);
        return parts.join(" \u00b7 ");
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
      case "formula_prep": {
        const d = event.data as FormulaPrepData;
        const amt = d.amountMl ? displayAmount(d.amountMl) : "";
        return amt || "Formula prepared";
      }
      case "medication": {
        const d = event.data as MedicationData;
        const parts = [d.name];
        if (d.dosage) parts.push(d.dosage);
        return parts.join(" · ");
      }
      default:
        return "";
    }
  };

  const closeSheet = () => setActiveSheet(null);

  return (
    <ScreenContainer className="px-4 pt-2" glassBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_HEIGHT + 16 }}>
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
                    {isAuthenticated && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          const msg = syncing
                            ? "Syncing now..."
                            : state.lastSyncedAt
                            ? `Last synced ${formatRelativeTime(state.lastSyncedAt)}`
                            : "Not yet synced";
                          Alert.alert("Sync Status", msg, [
                            { text: "Dismiss", style: "cancel" },
                            { text: "Sync Now", onPress: handleSyncNow },
                          ]);
                        }}
                        style={{ padding: 3, justifyContent: "center", alignItems: "center" }}
                      >
                        {syncing ? (
                          <ActivityIndicator size="small" color={colors.warning} style={{ width: 12, height: 12 }} />
                        ) : (
                          <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: state.lastSyncedAt ? colors.success : colors.muted,
                          }} />
                        )}
                      </Pressable>
                    )}
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

        {/* Summary Cards */}
        <View className="flex-row gap-2 mb-3">
          <GlassSurface borderRadius={14} tintColor={colors.feed} style={styles.summaryCard}>
            <View style={styles.summaryCardInner}>
              <IconSymbol name="fork.knife" size={22} color={colors.feed} />
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {displayAmount(todayFeedMl)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Feed</Text>
            </View>
          </GlassSurface>
          <GlassSurface borderRadius={14} tintColor={colors.diaper} style={styles.summaryCard}>
            <View style={styles.summaryCardInner}>
              <IconSymbol name="drop.fill" size={22} color={colors.diaper} />
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>💧 {todayDiapers.pee}</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>💩 {todayDiapers.poo}</Text>
              </View>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Diapers</Text>
            </View>
          </GlassSurface>
          <GlassSurface borderRadius={14} tintColor={colors.sleep} style={styles.summaryCard}>
            <View style={styles.summaryCardInner}>
              <IconSymbol name="moon.fill" size={22} color={colors.sleep} />
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {formatDuration(todaySleepMin)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Sleep</Text>
            </View>
          </GlassSurface>
          <GlassSurface borderRadius={14} tintColor={colors.pump} style={styles.summaryCard}>
            <View style={styles.summaryCardInner}>
              <IconSymbol name="drop.triangle.fill" size={22} color={colors.pump} />
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {displayAmount(todayPumpMl)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>Pumped</Text>
            </View>
          </GlassSurface>
        </View>

        {/* Single AI insight slot — Alert > Nudge > nothing */}
        {homeInsight && (
          <View style={{ marginBottom: 12 }}>
            <InlineAIInsight
              variant={homeInsight.variant}
              text={homeInsight.text}
              actionLabel={homeInsight.actionLabel}
              onAction={() => setActiveSheet(homeInsight.actionSheet)}
              dismissible={homeInsight.variant === "nudge"}
              onDismiss={() => setNudgeDismissed(true)}
            />
          </View>
        )}

        {/* Quick Actions */}
        <Text className="text-lg font-semibold text-foreground mb-3">Log Event</Text>
        {(() => {
          const isSleeping = !!state.activeSleep;

          // Primary row: the three most-used actions, full-width feel
          const primaryActions: { type: SheetType; label: string; icon: Parameters<typeof IconSymbol>[0]["name"]; color: string; isStopSleep: boolean }[] = [
            { type: "feed", label: "Feed", icon: "fork.knife", color: colors.feed, isStopSleep: false },
            { type: "sleep", label: isSleeping ? "Stop Sleep" : "Sleep", icon: "moon.fill", color: colors.sleep, isStopSleep: isSleeping },
            { type: "diaper", label: "Diaper", icon: "drop.fill", color: colors.diaper, isStopSleep: false },
          ];

          // Secondary row: less frequent actions + utility actions, scrollable
          const secondaryActions = [
            { type: "observation" as const, label: "Note", icon: "eye.fill" as const, color: colors.observation },
            { type: "pump" as const, label: "Pump", icon: "drop.triangle.fill" as const, color: colors.pump },
            { type: "formula_prep" as const, label: "Formula", icon: "flask.fill" as const, color: colors.formula },
            { type: "medication" as const, label: "Meds", icon: "pills.fill" as const, color: colors.medication },
            { type: "growth" as const, label: "Growth", icon: "chart.line.uptrend.xyaxis" as const, color: colors.success },
            { type: "import" as const, label: "Import", icon: "square.and.arrow.down" as const, color: colors.primary },
          ];

          return (
            <View className="mb-6" style={{ gap: 8 }}>
              {/* Primary: Feed / Sleep / Diaper */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {primaryActions.map((action) => (
                  <Pressable
                    key={action.type + (action.isStopSleep ? "-stop" : "")}
                    onPress={async () => {
                      if (action.isStopSleep) {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        await stopSleep();
                      } else {
                        setActiveSheet(action.type);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.primaryAction,
                      {
                        backgroundColor: action.isStopSleep ? action.color + "30" : action.color + "18",
                        borderColor: action.isStopSleep ? action.color + "70" : action.color + "35",
                      },
                      pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.primaryActionIcon, { backgroundColor: action.color + "35" }]}>
                      <IconSymbol name={action.icon} size={26} color={action.color} />
                    </View>
                    <Text style={[styles.primaryActionLabel, { color: colors.foreground }]}>
                      {action.label}
                    </Text>
                    {action.isStopSleep && (
                      <Text style={{ fontSize: 10, color: action.color, fontWeight: "600", marginTop: 1 }}>
                        TAP TO STOP
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Secondary: Note / Pump / Formula / Meds / Growth / Import */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {secondaryActions.map((action) => (
                  <Pressable
                    key={action.type}
                    onPress={() => setActiveSheet(action.type)}
                    style={({ pressed }) => [
                      styles.quickActionFixed,
                      { backgroundColor: action.color + "14", borderColor: action.color + "30" },
                      pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.quickActionIconSm, { backgroundColor: action.color + "28" }]}>
                      <IconSymbol name={action.icon} size={16} color={action.color} />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Today's Projection */}
        <TodayProjectionCard />

        {/* Recent Activity */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text className="text-lg font-semibold text-foreground">Today's Activity</Text>
          {todayEvents.length > 0 && (
            <Pressable
              onPress={toggleSelectMode}
              style={({ pressed }) => [
                styles.selectBtn,
                {
                  backgroundColor: selectMode ? colors.primary + "15" : colors.surface,
                  borderColor: selectMode ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: selectMode ? colors.primary : colors.muted, fontWeight: "600", fontSize: 13 }}>
                {selectMode ? "Cancel" : "Select"}
              </Text>
            </Pressable>
          )}
        </View>
        {selectMode && (
          <View style={[styles.selectBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
              {selectedIds.size} selected
            </Text>
            <Pressable
              onPress={selectedIds.size === todayEvents.length ? () => setSelectedIds(new Set()) : selectAllToday}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                {selectedIds.size === todayEvents.length ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>
        )}
        {todayEvents.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              No events logged today.{"\n"}Tap a button above to start tracking!
            </Text>
          </View>
        ) : (
          todayEvents.map((event) => {
            const isSelected = selectedIds.has(event.id);
            return (
              <Pressable
                key={event.id}
                onPress={() => {
                  if (event.type === "deletion_audit") return; // audit entries are not tappable
                  if (selectMode) {
                    toggleSelect(event.id);
                  } else {
                    setViewingEvent(event);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                onLongPress={() => {
                  if (event.type === "deletion_audit") return; // audit entries cannot be selected
                  if (!selectMode) {
                    setSelectMode(true);
                    setSelectedIds(new Set([event.id]));
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                }}
                style={({ pressed }) => [
                  styles.eventRow,
                  {
                    backgroundColor: isSelected ? colors.primary + "10" : colors.surface,
                    borderColor: isSelected ? colors.primary + "40" : colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {selectMode && (
                  <IconSymbol
                    name={isSelected ? "checkmark.square.fill" : "square"}
                    size={22}
                    color={isSelected ? colors.primary : colors.muted}
                  />
                )}
                <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.type) + "20" }]}>
                  <IconSymbol name={getEventIcon(event.type)} size={18} color={getEventColor(event.type)} />
                </View>
                <View style={styles.eventContent}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[
                      styles.eventTitle,
                      { color: event.type === "deletion_audit" ? colors.muted : colors.foreground },
                      event.type === "deletion_audit" && { fontStyle: "italic" },
                    ]}>
                      {event.type === "deletion_audit"
                        ? `${(event.data as any).deletedByName || "Someone"} deleted:`
                        : event.type === "formula_prep" ? "Formula Prep"
                        : event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                    </Text>
                    {!selectMode && event.type !== "deletion_audit" && (
                      <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "600" }}>EDIT</Text>
                      </View>
                    )}
                  </View>
                  {event.type === "deletion_audit" ? (
                    <Text style={[styles.eventSummary, { color: colors.muted, fontStyle: "italic" }]}>
                      {(event.data as any).deletedEventLabel || (event.data as any).deletedEventType || "Unknown event"}
                    </Text>
                  ) : (
                    <Text style={[styles.eventSummary, { color: colors.muted }]}>
                      {getEventSummary(event)}
                    </Text>
                  )}
                  {event.loggedByName && event.type !== "deletion_audit" && (
                    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
                      Logged by {event.loggedBy === user?.id?.toString() ? "You" : event.loggedByName}
                    </Text>
                  )}
                </View>
                {!selectMode && event.type !== "deletion_audit" && (
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={[styles.eventTime, { color: colors.muted }]}>
                      {formatTime(event.timestamp)}
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeleteEvent(event);
                      }}
                      style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
                    >
                      <IconSymbol name="trash.fill" size={14} color={colors.error + "80"} />
                    </Pressable>
                  </View>
                )}
                {!selectMode && event.type === "deletion_audit" && (
                  <Text style={[styles.eventTime, { color: colors.muted }]}>
                    {formatTime(event.timestamp)}
                  </Text>
                )}
                {selectMode && (
                  <Text style={[styles.eventTime, { color: colors.muted }]}>
                    {formatTime(event.timestamp)}
                  </Text>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Batch Delete Bar */}
      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.batchDeleteBar, { backgroundColor: colors.error }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            {selectedIds.size} event{selectedIds.size !== 1 ? "s" : ""} selected
          </Text>
          <Pressable
            onPress={handleBatchDelete}
            style={({ pressed }) => [
              styles.batchDeleteBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="trash.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete</Text>
          </Pressable>
        </View>
      )}

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
      <Modal visible={activeSheet === "formula_prep"} animationType="slide" presentationStyle="pageSheet">
        <LogFormulaPrepSheet onClose={closeSheet} />
      </Modal>
      <Modal visible={activeSheet === "medication"} animationType="slide" presentationStyle="pageSheet">
        <LogMedicationSheet onClose={closeSheet} />
      </Modal>

      {/* Event Detail Sheet */}
      <EventDetailSheet
        visible={viewingEvent !== null}
        event={viewingEvent}
        onClose={() => setViewingEvent(null)}
        onEdit={() => {
          const ev = viewingEvent;
          setViewingEvent(null);
          setTimeout(() => setEditingEvent(ev), 300);
        }}
      />

      {/* Edit Event Sheet */}
      <EditEventSheet
        visible={editingEvent !== null}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
      />

      {/* Undo Delete Snackbar */}
      {pendingDelete && (
        <UndoSnackbar
          key={pendingDelete.id}
          message={`${pendingDelete.type.charAt(0).toUpperCase() + pendingDelete.type.slice(1)} deleted`}
          onUndo={() => {
            // Restore the event to local state by re-adding it with its original id
            addEvent({
              type: pendingDelete.type,
              timestamp: pendingDelete.timestamp,
              data: pendingDelete.data,
              loggedBy: pendingDelete.loggedBy,
              loggedByName: pendingDelete.loggedByName,
            });
            setPendingDelete(null);
          }}
          onCommit={() => {
            // Server delete already fired via deleteEvent(); just clear pending state
            setPendingDelete(null);
          }}
        />
      )}
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
  },
  summaryCardInner: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
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
  primaryAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 7,
  },
  primaryActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    minHeight: 44,
    justifyContent: "center",
  },
  quickActionFixed: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    minHeight: 44,
    justifyContent: "center",
  },
  quickActionIconSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 12,
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
  deleteBtn: {
    padding: 4,
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
  syncNowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  batchDeleteBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  batchDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
