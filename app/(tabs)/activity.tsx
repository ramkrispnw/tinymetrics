import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  StyleSheet,
  Alert,
  Platform,
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

export default function ActivityScreen() {
  const colors = useColors();
  const { state, deleteEvent } = useStore();
  const [filter, setFilter] = useState<FilterType>("all");
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return state.events;
    return state.events.filter((e) => e.type === filter);
  }, [state.events, filter]);

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
      default: return "info.circle.fill" as const;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "feed": return colors.feed;
      case "sleep": return colors.sleep;
      case "diaper": return colors.diaper;
      case "observation": return colors.observation;
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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "feed", label: "Feed" },
    { key: "sleep", label: "Sleep" },
    { key: "diaper", label: "Diaper" },
    { key: "observation", label: "Notes" },
  ];

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

  return (
    <ScreenContainer className="px-4 pt-2">
      {/* Header */}
      <Text className="text-2xl font-bold text-foreground mb-3">Activity</Text>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
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
      </View>

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
              No events found.{"\n"}Start logging from the Home tab!
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
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
});
