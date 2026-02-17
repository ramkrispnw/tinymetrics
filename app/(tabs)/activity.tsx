import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  formatTime,
  formatDate,
  formatDuration,
  getDayKey,
  mlToOz,
  type BabyEvent,
  type EventType,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
} from "@/lib/store";
import { EditEventSheet } from "@/components/edit-event-sheet";
import * as Haptics from "expo-haptics";

type FilterType = "all" | EventType;
type DateRange = "today" | "yesterday" | "week" | "3months" | "custom";

export default function ActivityScreen() {
  const colors = useColors();
  const { state, deleteEvent } = useStore();
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustomStart, setAppliedCustomStart] = useState<Date | null>(null);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<Date | null>(null);

  // Calculate date range bounds
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    switch (dateRange) {
      case "today":
        return { start: startOfToday, end: endOfToday };
      case "yesterday": {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 1);
        const e = new Date(endOfToday);
        e.setDate(e.getDate() - 1);
        return { start: s, end: e };
      }
      case "week": {
        const s = new Date(startOfToday);
        s.setDate(s.getDate() - 6);
        return { start: s, end: endOfToday };
      }
      case "3months": {
        const s = new Date(startOfToday);
        s.setMonth(s.getMonth() - 3);
        return { start: s, end: endOfToday };
      }
      case "custom":
        if (appliedCustomStart && appliedCustomEnd) {
          return { start: appliedCustomStart, end: appliedCustomEnd };
        }
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }
  }, [dateRange, appliedCustomStart, appliedCustomEnd]);

  const filteredEvents = useMemo(() => {
    let events = state.events;

    // Apply date range filter
    if (dateRangeBounds.start && dateRangeBounds.end) {
      const startMs = dateRangeBounds.start.getTime();
      const endMs = dateRangeBounds.end.getTime();
      events = events.filter((e) => {
        const ts = new Date(e.timestamp).getTime();
        return ts >= startMs && ts <= endMs;
      });
    }

    // Apply type filter
    if (filter !== "all") {
      events = events.filter((e) => e.type === filter);
    }

    return events;
  }, [state.events, filter, dateRangeBounds]);

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

  const getEventIcon = (type: string) => {
    switch (type) {
      case "feed": return "fork.knife" as const;
      case "sleep": return "moon.fill" as const;
      case "diaper": return "drop.fill" as const;
      case "observation": return "eye.fill" as const;
      case "growth": return "chart.line.uptrend.xyaxis" as const;
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
        return d.durationMin ? formatDuration(d.durationMin) : "In progress";
      }
      case "diaper": {
        const d = event.data as DiaperData;
        const details = [];
        details.push(d.type === "both" ? "Pee & Poo" : d.type === "pee" ? "Pee" : "Poo");
        if (d.pooColor) details.push(d.pooColor);
        if (d.pooConsistency) details.push(d.pooConsistency);
        return details.join(" · ");
      }
      case "observation": {
        const d = event.data as ObservationData;
        return `${d.category.replace("_", " ")} · ${d.severity}`;
      }
      case "growth": {
        const d = event.data as any;
        const parts = [];
        if (d.weightKg) parts.push(`${d.weightKg} kg`);
        if (d.heightCm) parts.push(`${d.heightCm} cm`);
        return parts.join(" · ") || "Growth logged";
      }
      default:
        return "";
    }
  };

  const handleDelete = (event: BabyEvent) => {
    if (Platform.OS === "web") {
      deleteEvent(event.id);
      return;
    }
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteEvent(event.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleEdit = (event: BabyEvent) => {
    setEditingEvent(event);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleApplyCustomRange = () => {
    const startDate = new Date(customStart + "T00:00:00");
    const endDate = new Date(customEnd + "T23:59:59.999");
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      if (Platform.OS === "web") {
        alert("Please enter valid dates in YYYY-MM-DD format");
      } else {
        Alert.alert("Invalid Date", "Please enter valid dates in YYYY-MM-DD format");
      }
      return;
    }
    if (startDate > endDate) {
      if (Platform.OS === "web") {
        alert("Start date must be before end date");
      } else {
        Alert.alert("Invalid Range", "Start date must be before end date");
      }
      return;
    }
    setAppliedCustomStart(startDate);
    setAppliedCustomEnd(endDate);
    setDateRange("custom");
    setShowCustomPicker(false);
  };

  const typeFilters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "feed", label: "Feed" },
    { key: "sleep", label: "Sleep" },
    { key: "diaper", label: "Diaper" },
    { key: "observation", label: "Notes" },
    { key: "growth", label: "Growth" },
  ];

  const dateRanges: { key: DateRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "Week" },
    { key: "3months", label: "3 Months" },
    { key: "custom", label: "Custom" },
  ];

  const customRangeLabel = appliedCustomStart && appliedCustomEnd
    ? `${appliedCustomStart.toLocaleDateString([], { month: "short", day: "numeric" })} - ${appliedCustomEnd.toLocaleDateString([], { month: "short", day: "numeric" })}`
    : null;

  const renderItem = useCallback(
    ({ item }: { item: BabyEvent }) => (
      <Pressable
        onPress={() => handleEdit(item)}
        style={({ pressed }) => [
          styles.eventRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.eventIcon, { backgroundColor: getEventColor(item.type) + "20" }]}>
          <IconSymbol name={getEventIcon(item.type)} size={18} color={getEventColor(item.type)} />
        </View>
        <View style={styles.eventContent}>
          <View style={styles.eventTitleRow}>
            <Text style={[styles.eventTitle, { color: colors.foreground }]}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
            <View style={[styles.editBadge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600" }}>Edit</Text>
            </View>
          </View>
          <Text style={[styles.eventSummary, { color: colors.muted }]}>
            {getEventSummary(item)}
          </Text>
        </View>
        <View style={styles.eventRight}>
          <Text style={[styles.eventTime, { color: colors.muted }]}>
            {formatTime(item.timestamp)}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              handleDelete(item);
            }}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
          >
            <IconSymbol name="trash.fill" size={16} color={colors.error + "80"} />
          </Pressable>
        </View>
      </Pressable>
    ),
    [colors, state.settings.units]
  );

  const flatData = useMemo(() => {
    const items: (BabyEvent | { type: "header"; key: string; title: string })[] = [];
    groupedEvents.forEach((group) => {
      items.push({ type: "header", key: group.key, title: group.title } as any);
      items.push(...group.data);
    });
    return items;
  }, [groupedEvents]);

  const eventCount = filteredEvents.length;

  return (
    <ScreenContainer className="px-4 pt-2">
      {/* Header */}
      <View style={styles.headerRow}>
        <Text className="text-2xl font-bold text-foreground">Activity</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary + "15" }]}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
            {eventCount} event{eventCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Date Range Filter */}
      <Text style={[styles.filterLabel, { color: colors.muted }]}>Date Range</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateFilterScroll}
        contentContainerStyle={styles.dateFilterRow}
      >
        {dateRanges.map((d) => (
          <Pressable
            key={d.key}
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
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.dateFilterBtn,
              {
                backgroundColor: dateRange === d.key ? colors.primary : colors.surface,
                borderColor: dateRange === d.key ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={{
                color: dateRange === d.key ? "#fff" : colors.muted,
                fontWeight: dateRange === d.key ? "700" : "500",
                fontSize: 12,
              }}
            >
              {d.key === "custom" && dateRange === "custom" && customRangeLabel
                ? customRangeLabel
                : d.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Type Filters */}
      <Text style={[styles.filterLabel, { color: colors.muted }]}>Event Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeFilterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {typeFilters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => {
              setFilter(f.key);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.filterBtn,
              {
                backgroundColor: filter === f.key ? colors.primary + "20" : colors.surface,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={{
                color: filter === f.key ? colors.primary : colors.muted,
                fontWeight: filter === f.key ? "700" : "500",
                fontSize: 13,
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Event List */}
      <FlatList
        data={flatData}
        keyExtractor={(item: any) => item.id || item.key}
        renderItem={({ item }: any) => {
          if (item.type === "header") {
            return (
              <Text style={[styles.dayHeader, { color: colors.foreground }]}>
                {item.title}
              </Text>
            );
          }
          return renderItem({ item });
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              No events found for this period.{"\n"}Try adjusting the date range or filters.
            </Text>
          </View>
        }
      />

      {/* Edit Event Sheet */}
      <EditEventSheet
        visible={editingEvent !== null}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
      />

      {/* Custom Date Range Picker Modal */}
      <Modal visible={showCustomPicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.customPickerCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.customPickerTitle, { color: colors.foreground }]}>
              Custom Date Range
            </Text>

            <Text style={[styles.customPickerLabel, { color: colors.muted }]}>START DATE</Text>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={[
                styles.customPickerInput,
                { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
              ]}
              returnKeyType="done"
            />

            <Text style={[styles.customPickerLabel, { color: colors.muted }]}>END DATE</Text>
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={[
                styles.customPickerInput,
                { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
              ]}
              returnKeyType="done"
            />

            <View style={styles.customPickerButtons}>
              <Pressable
                onPress={() => setShowCustomPicker(false)}
                style={({ pressed }) => [
                  styles.customPickerBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyCustomRange}
                style={({ pressed }) => [
                  styles.customPickerBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dateFilterScroll: {
    marginBottom: 10,
    flexGrow: 0,
  },
  dateFilterRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 8,
  },
  dateFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeFilterScroll: {
    marginBottom: 12,
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
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
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  editBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventSummary: {
    fontSize: 12,
    marginTop: 2,
  },
  eventRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  deleteBtn: {
    padding: 4,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 32,
  },
  // Custom date range picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  customPickerCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
  },
  customPickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  customPickerLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  customPickerInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 0.5,
  },
  customPickerButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  customPickerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
});
