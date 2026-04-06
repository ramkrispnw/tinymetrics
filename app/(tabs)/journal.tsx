import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { FilterChip } from "@/components/filter-chip";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  MILESTONE_CATEGORIES,
  formatDate,
  formatDuration,
  formatTime,
  getDayKey,
  getSleepMinutesForDay,
  mlToOz,
  type BabyEvent,
  type DiaperData,
  type EventType,
  type FeedData,
  type FormulaPrepData,
  type MedicationData,
  type Milestone,
  type MilestoneCategory,
  type ObservationData,
  type PumpData,
  type SleepData,
} from "@/lib/store";
import { EditEventSheet } from "@/components/edit-event-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { UndoSnackbar } from "@/components/undo-snackbar";
import { useAuth } from "@/hooks/use-auth";
import { pickImage, uploadPhotoToCloud } from "@/lib/image-utils";

type JournalView = "timeline" | "events" | "milestones";
type FilterType = "all" | EventType;
type DateRange = "today" | "yesterday" | "week" | "3months" | "custom";

export default function JournalScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { state, deleteEvent, deleteEvents, addEvent, addMilestone, deleteMilestone } =
    useStore();

  const [activeView, setActiveView] = useState<JournalView>("timeline");

  // ── Events view state ──
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [searchText, setSearchText] = useState("");
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<BabyEvent | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustomStart, setAppliedCustomStart] = useState<Date | null>(null);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<Date | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<BabyEvent | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // ── Milestones view state ──
  const [filterCat, setFilterCat] = useState<MilestoneCategory | "all">("all");
  const [gridMode, setGridMode] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // ── Helper functions ──
  const getEventIcon = (type: string) => {
    switch (type) {
      case "feed": return "fork.knife" as const;
      case "sleep": return "moon.fill" as const;
      case "diaper": return "drop.fill" as const;
      case "observation": return "eye.fill" as const;
      case "growth": return "chart.line.uptrend.xyaxis" as const;
      case "pump": return "drop.triangle.fill" as const;
      case "formula_prep": return "flask.fill" as const;
      case "medication": return "pills.fill" as const;
      case "deletion_audit": return "trash.fill" as const;
      default: return "info.circle.fill" as const;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "feed": return colors.feed;
      case "sleep": return colors.sleep;
      case "diaper": return colors.diaper;
      case "observation": return colors.observation;
      case "growth": return colors.success;
      case "pump": return colors.pump;
      case "formula_prep": return (colors as any).formula || colors.warning;
      case "medication": return (colors as any).medication || colors.error;
      case "deletion_audit": return colors.muted;
      default: return colors.muted;
    }
  };

  const getEventSummary = (event: BabyEvent): string => {
    switch (event.type) {
      case "feed": {
        const d = event.data as FeedData;
        const amt = d.amountMl
          ? state.settings.units === "oz"
            ? `${mlToOz(d.amountMl)} oz`
            : `${d.amountMl} ml`
          : "";
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
        return parts.join(" · ");
      }
      case "observation": {
        const d = event.data as ObservationData;
        return `${d.category.replace("_", " ")} · ${d.severity}`;
      }
      case "pump": {
        const d = event.data as PumpData;
        const amt = d.amountMl
          ? state.settings.units === "oz"
            ? `${mlToOz(d.amountMl)} oz`
            : `${d.amountMl} ml`
          : "";
        const dur = d.durationMin ? formatDuration(d.durationMin) : "";
        return [amt, dur].filter(Boolean).join(" · ") || "Pump session";
      }
      case "formula_prep": {
        const d = event.data as FormulaPrepData;
        const amt = d.amountMl
          ? state.settings.units === "oz"
            ? `${mlToOz(d.amountMl)} oz`
            : `${d.amountMl} ml`
          : "";
        return amt ? `Prepared ${amt}` : "Formula prepared";
      }
      case "medication": {
        const d = event.data as MedicationData;
        return [d.name, d.dosage].filter(Boolean).join(" · ");
      }
      case "deletion_audit": {
        const d = event.data as any;
        return d.deletedEventLabel || d.deletedEventType || "Event deleted";
      }
      default:
        return "";
    }
  };

  // ── Events view: date range bounds ──
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    switch (dateRange) {
      case "today": return { start: startOfToday, end: endOfToday };
      case "yesterday": {
        const s = new Date(startOfToday); s.setDate(s.getDate() - 1);
        const e = new Date(endOfToday); e.setDate(e.getDate() - 1);
        return { start: s, end: e };
      }
      case "week": {
        const s = new Date(startOfToday); s.setDate(s.getDate() - 6);
        return { start: s, end: endOfToday };
      }
      case "3months": {
        const s = new Date(startOfToday); s.setMonth(s.getMonth() - 3);
        return { start: s, end: endOfToday };
      }
      case "custom":
        if (appliedCustomStart && appliedCustomEnd) {
          return { start: appliedCustomStart, end: appliedCustomEnd };
        }
        return { start: null, end: null };
      default: return { start: null, end: null };
    }
  }, [dateRange, appliedCustomStart, appliedCustomEnd]);

  const filteredEvents = useMemo(() => {
    let events = state.events;
    if (dateRangeBounds.start && dateRangeBounds.end) {
      const s = dateRangeBounds.start.getTime();
      const e = dateRangeBounds.end.getTime();
      events = events.filter((ev) => {
        const ts = new Date(ev.timestamp).getTime();
        return ts >= s && ts <= e;
      });
    }
    if (filter !== "all") {
      events = events.filter((ev) => ev.type === filter);
    }
    if (!showAuditLog) {
      events = events.filter((ev) => ev.type !== "deletion_audit");
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      events = events.filter((ev) => {
        const summary = getEventSummary(ev).toLowerCase();
        return ev.type.toLowerCase().includes(q) || summary.includes(q);
      });
    }
    if (pendingDeleteEvent) {
      events = events.filter((ev) => ev.id !== pendingDeleteEvent.id);
    }
    return events;
  }, [state.events, filter, dateRangeBounds, showAuditLog, searchText, pendingDeleteEvent]);

  const groupedEvents = useMemo(() => {
    const groups: { key: string; title: string; data: BabyEvent[] }[] = [];
    const map = new Map<string, BabyEvent[]>();
    filteredEvents.forEach((e) => {
      const key = getDayKey(e.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    map.forEach((data, key) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let title = formatDate(key);
      if (key === getDayKey(today.toISOString())) title = "Today";
      else if (key === getDayKey(yesterday.toISOString())) title = "Yesterday";
      groups.push({ key, title, data });
    });
    return groups;
  }, [filteredEvents]);

  const flatData = useMemo(() => {
    const items: (BabyEvent | { type: "header"; key: string; title: string })[] = [];
    groupedEvents.forEach((group) => {
      items.push({ type: "header", key: group.key, title: group.title } as any);
      items.push(...group.data);
    });
    return items;
  }, [groupedEvents]);

  const handleDeleteEvent = (event: BabyEvent) => {
    if (pendingDeleteEvent) {
      deleteEvent(pendingDeleteEvent.id);
    }
    setPendingDeleteEvent(event);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEditEvent = (event: BabyEvent) => {
    setEditingEvent(event);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleSelectMode = () => {
    if (selectMode) setSelectedIds(new Set());
    setSelectMode(!selectMode);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    Alert.alert("Delete Events", `Delete ${count} event${count !== 1 ? "s" : ""}?`, [
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
    ]);
  };

  const handleApplyCustomRange = () => {
    const startDate = new Date(customStart + "T00:00:00");
    const endDate = new Date(customEnd + "T23:59:59.999");
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert("Invalid Date", "Please enter valid dates in YYYY-MM-DD format");
      return;
    }
    if (startDate > endDate) {
      Alert.alert("Invalid Range", "Start date must be before end date");
      return;
    }
    setAppliedCustomStart(startDate);
    setAppliedCustomEnd(endDate);
    setDateRange("custom");
    setShowCustomPicker(false);
  };

  // ── Timeline view: merge events + milestones ──
  const timelineItems = useMemo(() => {
    const items: (
      | { kind: "event"; ts: number; data: BabyEvent }
      | { kind: "milestone"; ts: number; data: Milestone }
    )[] = [];

    state.events
      .filter((e) => e.type !== "deletion_audit")
      .forEach((e) => items.push({ kind: "event", ts: new Date(e.timestamp).getTime(), data: e }));

    state.milestones.forEach((m) =>
      items.push({ kind: "milestone", ts: new Date(m.date + "T12:00:00").getTime(), data: m })
    );

    items.sort((a, b) => b.ts - a.ts);
    return items;
  }, [state.events, state.milestones]);

  const timelineGroups = useMemo(() => {
    const groups: { key: string; title: string; items: typeof timelineItems }[] = [];
    const map = new Map<string, typeof timelineItems>();
    timelineItems.forEach((item) => {
      const key = getDayKey(new Date(item.ts).toISOString());
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    map.forEach((items, key) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let title = formatDate(key);
      if (key === getDayKey(today.toISOString())) title = "Today";
      else if (key === getDayKey(yesterday.toISOString())) title = "Yesterday";
      groups.push({ key, title, items });
    });
    return groups;
  }, [timelineItems]);

  // ── Milestones view: filtered ──
  const filteredMilestones = useMemo(() => {
    if (filterCat === "all") return state.milestones;
    return state.milestones.filter((m) => m.category === filterCat);
  }, [state.milestones, filterCat]);

  const typeFilters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "feed", label: "Feed" },
    { key: "sleep", label: "Sleep" },
    { key: "diaper", label: "Diaper" },
    { key: "observation", label: "Notes" },
    { key: "growth", label: "Growth" },
    { key: "pump", label: "Pump" },
    { key: "formula_prep", label: "Formula" },
    { key: "medication", label: "Meds" },
  ];

  const dateRanges: { key: DateRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "Week" },
    { key: "3months", label: "3 Months" },
    { key: "custom", label: "Custom" },
  ];

  const customRangeLabel =
    appliedCustomStart && appliedCustomEnd
      ? `${appliedCustomStart.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} – ${appliedCustomEnd.toLocaleDateString([], { month: "short", day: "numeric" })}`
      : null;

  // ── Render helpers ──
  const renderEventRow = useCallback(
    (item: BabyEvent, inTimeline = false) => {
      const isSelected = selectedIds.has(item.id);
      const isAudit = item.type === "deletion_audit";
      const color = getEventColor(item.type);

      const renderRightActions = () => (
        <View style={styles.swipeActions}>
          <Pressable
            style={[styles.swipeEdit, { backgroundColor: colors.primary }]}
            onPress={() => handleEditEvent(item)}
          >
            <IconSymbol name="pencil" size={18} color="#fff" />
            <Text style={styles.swipeActionLabel}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.swipeDelete, { backgroundColor: colors.error }]}
            onPress={() => handleDeleteEvent(item)}
          >
            <IconSymbol name="trash.fill" size={18} color="#fff" />
            <Text style={styles.swipeActionLabel}>Delete</Text>
          </Pressable>
        </View>
      );

      const content = (
        <Pressable
          onPress={() => {
            if (isAudit) return;
            if (selectMode) {
              toggleSelect(item.id);
            } else {
              setDetailEvent(item);
            }
          }}
          onLongPress={() => {
            if (isAudit) return;
            if (!selectMode) {
              setSelectMode(true);
              setSelectedIds(new Set([item.id]));
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
          <View style={[styles.eventIcon, { backgroundColor: color + "20" }]}>
            <IconSymbol name={getEventIcon(item.type)} size={18} color={color} />
          </View>
          <View style={styles.eventContent}>
            <Text
              style={[
                styles.eventTitle,
                { color: isAudit ? colors.muted : colors.foreground },
                isAudit && { fontStyle: "italic" },
              ]}
            >
              {isAudit
                ? `${(item.data as any).deletedByName || "Someone"} deleted:`
                : item.type === "formula_prep"
                ? "Formula Prep"
                : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
            <Text style={[styles.eventSummary, { color: colors.muted, fontStyle: isAudit ? "italic" : "normal" }]}>
              {isAudit
                ? (item.data as any).deletedEventLabel || (item.data as any).deletedEventType || "Unknown event"
                : getEventSummary(item)}
            </Text>
            {item.loggedByName && !isAudit && (
              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
                Logged by {item.loggedBy === user?.id?.toString() ? "You" : item.loggedByName}
              </Text>
            )}
          </View>
          <Text style={[styles.eventTime, { color: colors.muted }]}>
            {formatTime(item.timestamp)}
          </Text>
        </Pressable>
      );

      // No swipe in select mode or for audit entries
      if (selectMode || isAudit || inTimeline) return content;

      return (
        <Swipeable key={item.id} renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
          {content}
        </Swipeable>
      );
    },
    [colors, state.settings.units, selectMode, selectedIds, user]
  );

  // ── Segment Control ──
  const SegmentControl = () => (
    <View style={[styles.segmentControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(["timeline", "events", "milestones"] as JournalView[]).map((view) => {
        const labels = { timeline: "Timeline", events: "Events", milestones: "Milestones" };
        const active = activeView === view;
        return (
          <Pressable
            key={view}
            onPress={() => {
              setActiveView(view);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.segmentBtn,
              active && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? "#fff" : colors.muted },
              ]}
            >
              {labels[view]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ── Timeline View ──
  const renderTimelineView = () => (
    <FlatList
      data={timelineGroups}
      keyExtractor={(g) => g.key}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
      ListEmptyComponent={
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            No events or milestones yet. Start tracking to see your journey here.
          </Text>
        </View>
      }
      renderItem={({ item: group }) => (
        <View>
          <Text style={[styles.dayHeader, { color: colors.foreground }]}>{group.title}</Text>
          {group.items.map((item) => {
            if (item.kind === "event") {
              return (
                <View key={`event-${item.data.id}`}>
                  {renderEventRow(item.data, true)}
                </View>
              );
            }
            const m = item.data as Milestone;
            const cat = MILESTONE_CATEGORIES.find((c) => c.key === m.category);
            return (
              <Pressable
                key={`milestone-${m.id}`}
                onPress={() => setSelectedMilestone(m)}
                style={({ pressed }) => [
                  styles.milestoneRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderLeftColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[styles.milestoneBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={{ fontSize: 18 }}>{cat?.icon || "⭐"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: colors.foreground }]}>{m.title}</Text>
                  <Text style={[styles.eventSummary, { color: colors.muted }]}>
                    {cat?.label || "Milestone"}
                  </Text>
                </View>
                {m.photoUri && (
                  <Image source={{ uri: m.photoUri }} style={styles.milestoneThumbnail} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    />
  );

  // ── Events View ──
  const renderEventsView = () => (
    <>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search events…"
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText("")}>
            <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Date range + event type filter rows */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {dateRanges.map((d) => (
            <FilterChip
              key={d.key}
              label={d.key === "custom" && dateRange === "custom" && customRangeLabel ? customRangeLabel : d.label}
              active={dateRange === d.key}
              onPress={() => {
                if (d.key === "custom") {
                  const now = new Date();
                  const weekAgo = new Date(now);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  if (!customStart) setCustomStart(getDayKey(weekAgo.toISOString()));
                  if (!customEnd) setCustomEnd(getDayKey(now.toISOString()));
                  setShowCustomPicker(true);
                } else {
                  setDateRange(d.key);
                }
              }}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {typeFilters.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              activeStyle="tinted"
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {selectMode && (
        <View style={[styles.selectBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
            {selectedIds.size} selected
          </Text>
          <Pressable onPress={selectedIds.size === filteredEvents.length ? () => setSelectedIds(new Set()) : () => setSelectedIds(new Set(filteredEvents.map((e) => e.id)))}>
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
              {selectedIds.size === filteredEvents.length ? "Deselect All" : "Select All"}
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={flatData}
        keyExtractor={(item: any) => item.id || item.key}
        renderItem={({ item }: any) => {
          if (item.type === "header") {
            return <Text style={[styles.dayHeader, { color: colors.foreground }]}>{item.title}</Text>;
          }
          return renderEventRow(item);
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: selectMode ? 120 : 100 }}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              No events found.{"\n"}Try adjusting the date range or filters.
            </Text>
          </View>
        }
      />

      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: colors.error }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            {selectedIds.size} event{selectedIds.size !== 1 ? "s" : ""} selected
          </Text>
          <Pressable
            onPress={handleBatchDelete}
            style={({ pressed }) => [styles.batchDeleteBtn, pressed && { opacity: 0.8 }]}
          >
            <IconSymbol name="trash.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  // ── Milestones View ──
  const renderMilestonesView = () => (
    <>
      {/* Category filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="All"
            active={filterCat === "all"}
            onPress={() => setFilterCat("all")}
          />
          {MILESTONE_CATEGORIES.map((cat) => (
            <FilterChip
              key={cat.key}
              label={`${cat.icon} ${cat.label}`}
              active={filterCat === cat.key}
              onPress={() => setFilterCat(cat.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        key={gridMode ? "grid" : "list"}
        data={filteredMilestones}
        keyExtractor={(m) => m.id}
        numColumns={gridMode ? 2 : 1}
        columnWrapperStyle={gridMode ? { gap: 10 } : undefined}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              No milestones yet.{"\n"}Tap + to record your baby's first moments.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const cat = MILESTONE_CATEGORIES.find((c) => c.key === item.category);
          if (gridMode) {
            return (
              <Pressable
                onPress={() => setSelectedMilestone(item)}
                style={({ pressed }) => [
                  styles.milestoneGridCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.milestoneGridPhoto} />
                ) : (
                  <View style={[styles.milestoneGridEmoji, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={{ fontSize: 32 }}>{cat?.icon || "⭐"}</Text>
                  </View>
                )}
                <View style={styles.milestoneGridInfo}>
                  <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.eventSummary, { color: colors.muted }]}>
                    {new Date(item.date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}
                  </Text>
                </View>
              </Pressable>
            );
          }
          return (
            <MilestoneCard
              milestone={item}
              colors={colors}
              onTap={() => setSelectedMilestone(item)}
              onDelete={() => {
                if (Platform.OS === "web") {
                  if (confirm("Delete this milestone?")) deleteMilestone(item.id);
                } else {
                  Alert.alert("Delete Milestone", "Are you sure?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteMilestone(item.id) },
                  ]);
                }
              }}
            />
          );
        }}
      />

      {/* FAB: Add Milestone */}
      <Pressable
        onPress={() => setShowAddMilestone(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </Pressable>
    </>
  );

  return (
    <ScreenContainer className="px-4 pt-2">
      {/* Header */}
      <View style={styles.header}>
        <Text className="text-2xl font-bold text-foreground">Journal</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {activeView === "events" && (
            <Pressable
              onPress={toggleSelectMode}
              style={({ pressed }) => [
                styles.headerBtn,
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
          {activeView === "milestones" && (
            <Pressable
              onPress={() => setGridMode(!gridMode)}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol
                name={gridMode ? "list.bullet" : "square.grid.2x2.fill"}
                size={18}
                color={colors.muted}
              />
            </Pressable>
          )}
          {activeView === "events" && (
            <Pressable
              onPress={() => setShowMoreMenu(true)}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="ellipsis" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Segment Control */}
      <SegmentControl />

      {/* View content */}
      {activeView === "timeline" && renderTimelineView()}
      {activeView === "events" && renderEventsView()}
      {activeView === "milestones" && renderMilestonesView()}

      {/* ─── Modals / Sheets ─── */}

      {/* Undo delete snackbar */}
      {pendingDeleteEvent && (
        <UndoSnackbar
          key={pendingDeleteEvent.id}
          message={`Deleted: ${pendingDeleteEvent.type.charAt(0).toUpperCase() + pendingDeleteEvent.type.slice(1)}`}
          onUndo={() => setPendingDeleteEvent(null)}
          onCommit={() => {
            deleteEvent(pendingDeleteEvent.id);
            setPendingDeleteEvent(null);
          }}
        />
      )}

      {/* Event detail */}
      {detailEvent && (
        <EventDetailSheet
          visible={true}
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={() => {
            const ev = detailEvent;
            setDetailEvent(null);
            setTimeout(() => handleEditEvent(ev), 200);
          }}
        />
      )}

      {/* Edit event */}
      <EditEventSheet
        visible={editingEvent !== null}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
      />

      {/* Custom date range picker */}
      <Modal visible={showCustomPicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.customPickerCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Custom Date Range</Text>
            <Text style={[styles.pickerLabel, { color: colors.muted }]}>START DATE</Text>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={[styles.pickerInput, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />
            <Text style={[styles.pickerLabel, { color: colors.muted }]}>END DATE</Text>
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={[styles.pickerInput, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => setShowCustomPicker(false)}
                style={[styles.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyCustomRange}
                style={[styles.pickerBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* More menu (audit log toggle) */}
      <Modal visible={showMoreMenu} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreMenu(false)}>
          <View style={[styles.moreMenuCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Pressable
              onPress={() => {
                setShowAuditLog(!showAuditLog);
                setShowMoreMenu(false);
              }}
              style={({ pressed }) => [styles.moreMenuItem, pressed && { opacity: 0.7 }]}
            >
              <IconSymbol name="doc.text.magnifyingglass" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
                {showAuditLog ? "Hide" : "Show"} Deletion Log
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Add Milestone */}
      <Modal visible={showAddMilestone} animationType="slide" presentationStyle="pageSheet">
        <AddMilestoneSheet
          colors={colors}
          onSave={(m) => {
            addMilestone(m);
            setShowAddMilestone(false);
          }}
          onClose={() => setShowAddMilestone(false)}
        />
      </Modal>

      {/* Milestone detail */}
      <Modal
        visible={!!selectedMilestone}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMilestone(null)}
      >
        {selectedMilestone && (
          <MilestoneDetailSheet
            milestone={selectedMilestone}
            colors={colors}
            onClose={() => setSelectedMilestone(null)}
            onDelete={() => {
              if (Platform.OS === "web") {
                if (confirm("Delete this milestone?")) {
                  deleteMilestone(selectedMilestone.id);
                  setSelectedMilestone(null);
                }
              } else {
                Alert.alert("Delete Milestone", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteMilestone(selectedMilestone.id);
                      setSelectedMilestone(null);
                    },
                  },
                ]);
              }
            }}
          />
        )}
      </Modal>
    </ScreenContainer>
  );
}

// ─── Milestone sub-components (ported from milestones.tsx) ───

function MilestoneCard({
  milestone,
  colors,
  onTap,
  onDelete,
}: {
  milestone: Milestone;
  colors: any;
  onTap: () => void;
  onDelete: () => void;
}) {
  const cat = MILESTONE_CATEGORIES.find((c) => c.key === milestone.category);
  const dateStr = new Date(milestone.date + "T00:00:00").toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [
        ms.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={ms.cardHeader}>
        <View style={ms.cardLeft}>
          <Text style={ms.cardIcon}>{cat?.icon || "⭐"}</Text>
          <View style={ms.cardInfo}>
            <Text style={[ms.cardTitle, { color: colors.foreground }]}>{milestone.title}</Text>
            <Text style={[ms.cardDate, { color: colors.muted }]}>
              {dateStr} · {cat?.label || "Other"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}
        >
          <IconSymbol name="trash.fill" size={18} color={colors.error} />
        </Pressable>
      </View>
      {milestone.notes ? (
        <Text style={[ms.cardNotes, { color: colors.muted }]}>{milestone.notes}</Text>
      ) : null}
      {milestone.photoUri ? (
        <Image source={{ uri: milestone.photoUri }} style={ms.cardPhoto} />
      ) : null}
      {milestone.loggedByName ? (
        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>
          Logged by {milestone.loggedByName}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MilestoneDetailSheet({
  milestone,
  colors,
  onClose,
  onDelete,
}: {
  milestone: Milestone;
  colors: any;
  onClose: () => void;
  onDelete: () => void;
}) {
  const cat = MILESTONE_CATEGORIES.find((c) => c.key === milestone.category);
  const dateStr = new Date(milestone.date + "T00:00:00").toLocaleDateString([], {
    month: "long", day: "numeric", year: "numeric",
  });
  const createdStr = new Date(milestone.createdAt).toLocaleDateString([], {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  return (
    <View style={[ms.sheetContainer, { backgroundColor: colors.background }]}>
      <View style={[ms.sheetHeader, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[ms.sheetCancel, { color: colors.primary }]}>Close</Text>
        </Pressable>
        <Text style={[ms.sheetTitle, { color: colors.foreground }]}>Milestone</Text>
        <Pressable onPress={onDelete} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}>
          <IconSymbol name="trash.fill" size={18} color={colors.error} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 56 }}>{cat?.icon || "⭐"}</Text>
          <View style={[ms.catChip, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50", marginTop: 10 }]}>
            <Text style={[ms.catChipText, { color: colors.primary }]}>{cat?.label || "Other"}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: 6 }}>
          {milestone.title}
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 20 }}>
          {dateStr}
        </Text>
        {milestone.photoUri ? (
          <Image
            source={{ uri: milestone.photoUri }}
            style={{ width: "100%", height: 240, borderRadius: 14, marginBottom: 20, resizeMode: "cover" }}
          />
        ) : null}
        {milestone.notes ? (
          <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, letterSpacing: 0.5 }}>NOTES</Text>
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>{milestone.notes}</Text>
          </View>
        ) : null}
        <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: colors.border }]}>
          {milestone.loggedByName ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Logged by</Text>
              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{milestone.loggedByName}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Recorded on</Text>
            <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{createdStr}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function AddMilestoneSheet({
  colors,
  onSave,
  onClose,
}: {
  colors: any;
  onSave: (m: Omit<Milestone, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [category, setCategory] = useState<MilestoneCategory>("motor");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [photoMime, setPhotoMime] = useState<string>("image/jpeg");
  const [saving, setSaving] = useState(false);

  const handlePickPhoto = async () => {
    const result = await pickImage("gallery");
    if (result) {
      setPhotoUri(result.uri);
      setPhotoBase64(result.base64);
      setPhotoMime(result.mimeType);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter a milestone title.");
      return;
    }
    setSaving(true);
    let finalPhotoUri = photoUri;
    if (photoBase64 && photoUri && !photoUri.startsWith("http")) {
      const cloudUrl = await uploadPhotoToCloud(photoBase64, photoMime);
      if (cloudUrl) finalPhotoUri = cloudUrl;
    }
    onSave({ title: title.trim(), date, category, notes: notes.trim() || undefined, photoUri: finalPhotoUri });
    setSaving(false);
  };

  return (
    <View style={[ms.sheetContainer, { backgroundColor: colors.background }]}>
      <View style={[ms.sheetHeader, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[ms.sheetCancel, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[ms.sheetTitle, { color: colors.foreground }]}>New Milestone</Text>
        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [{ opacity: pressed || saving ? 0.6 : 1 }]}>
          <Text style={[ms.sheetSave, { color: colors.primary }]}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={ms.sheetContent}>
        <Text style={[ms.label, { color: colors.muted }]}>MILESTONE TITLE</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. First smile, First steps…"
          placeholderTextColor={colors.muted}
          style={[ms.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
          autoFocus
        />
        <Text style={[ms.label, { color: colors.muted }]}>DATE</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={[ms.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
        />
        <Text style={[ms.label, { color: colors.muted }]}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {MILESTONE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              style={[
                ms.catBtn,
                {
                  backgroundColor: category === cat.key ? colors.primary + "20" : colors.surface,
                  borderColor: category === cat.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
              <Text style={{ fontSize: 12, color: category === cat.key ? colors.primary : colors.foreground, fontWeight: "600" }}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[ms.label, { color: colors.muted }]}>NOTES (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any details about this moment…"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
          style={[ms.input, ms.textArea, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
        />
        <Pressable
          onPress={handlePickPhoto}
          style={[ms.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={ms.photoPreview} />
          ) : (
            <>
              <IconSymbol name="camera.fill" size={22} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 14 }}>Add Photo</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentControl: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterContainer: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingLeft: 8,
    paddingRight: 8,
  },
  filterDivider: {
    width: 1,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
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
  swipeActions: {
    flexDirection: "row",
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeEdit: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
  },
  swipeDelete: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
  },
  swipeActionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 8,
    gap: 12,
  },
  milestoneBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    resizeMode: "cover",
  },
  milestoneGridCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  milestoneGridPhoto: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
  milestoneGridEmoji: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneGridInfo: {
    padding: 10,
    gap: 3,
  },
  fab: {
    position: "absolute",
    bottom: 16,
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
  batchBar: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  batchDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  customPickerCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  pickerInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  pickerBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  moreMenuCard: {
    width: 240,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  moreMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
});

// Milestone component styles
const ms = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  cardIcon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardDate: { fontSize: 12, marginTop: 2 },
  cardNotes: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  cardPhoto: { width: "100%", height: 180, borderRadius: 10, marginTop: 10, resizeMode: "cover" },
  sheetContainer: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetCancel: { fontSize: 16 },
  sheetSave: { fontSize: 16, fontWeight: "700" },
  sheetContent: { padding: 20, paddingBottom: 60, gap: 4 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 4 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  catBtn: { alignItems: "center", padding: 10, borderRadius: 12, borderWidth: 1, minWidth: 72, gap: 4 },
  photoBtn: {
    marginTop: 8,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontWeight: "600" },
});
