import { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  getDayKey,
  formatDuration,
  mlToOz,
  type FeedData,
  type SleepData,
  type DiaperData,
  type GrowthEntry,
} from "@/lib/store";
import * as Haptics from "expo-haptics";

type Range = 7 | 14 | 30;

export default function TrendsScreen() {
  const colors = useColors();
  const { state } = useStore();
  const [range, setRange] = useState<Range>(7);

  const dateRange = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(getDayKey(d.toISOString()));
    }
    return days;
  }, [range]);

  const feedData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "feed" && getDayKey(e.timestamp) === day
      );
      const totalMl = dayEvents.reduce(
        (sum, e) => sum + ((e.data as FeedData).amountMl || 0),
        0
      );
      return { day, totalMl, count: dayEvents.length };
    });
  }, [dateRange, state.events]);

  const diaperData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "diaper" && getDayKey(e.timestamp) === day
      );
      let pee = 0;
      let poo = 0;
      dayEvents.forEach((e) => {
        const d = e.data as DiaperData;
        if (d.type === "pee") pee++;
        else if (d.type === "poo") poo++;
        else { pee++; poo++; }
      });
      return { day, pee, poo, total: dayEvents.length };
    });
  }, [dateRange, state.events]);

  const sleepData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "sleep" && getDayKey(e.timestamp) === day
      );
      const totalMin = dayEvents.reduce(
        (sum, e) => sum + ((e.data as SleepData).durationMin || 0),
        0
      );
      return { day, totalMin, count: dayEvents.length };
    });
  }, [dateRange, state.events]);

  const maxFeed = Math.max(...feedData.map((d) => d.totalMl), 1);
  const maxDiaper = Math.max(...diaperData.map((d) => d.total), 1);
  const maxSleep = Math.max(...sleepData.map((d) => d.totalMin), 1);

  const avgFeed = feedData.reduce((s, d) => s + d.totalMl, 0) / range;
  const avgDiaper = diaperData.reduce((s, d) => s + d.total, 0) / range;
  const avgSleep = sleepData.reduce((s, d) => s + d.totalMin, 0) / range;

  const displayAmount = (ml: number) => {
    if (state.settings.units === "oz") return `${mlToOz(ml)} oz`;
    return `${Math.round(ml)} ml`;
  };

  const formatDayLabel = (day: string) => {
    const d = new Date(day + "T12:00:00");
    return d.toLocaleDateString([], { weekday: "short" }).slice(0, 2);
  };

  const ranges: { key: Range; label: string }[] = [
    { key: 7, label: "7 Days" },
    { key: 14, label: "14 Days" },
    { key: 30, label: "30 Days" },
  ];

  const BarChart = ({
    data,
    maxVal,
    color,
    labelFn,
  }: {
    data: { day: string; value: number }[];
    maxVal: number;
    color: string;
    labelFn: (v: number) => string;
  }) => {
    const barWidth = range <= 7 ? 28 : range <= 14 ? 18 : 10;
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartBars}>
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            return (
              <View key={d.day} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: colors.border + "40" }]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: color,
                        height: `${Math.max(height, 2)}%`,
                      },
                    ]}
                  />
                </View>
                {range <= 14 && (
                  <Text style={[styles.barLabel, { color: colors.muted }]}>
                    {formatDayLabel(d.day)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-1">Trends</Text>
        <Text className="text-sm text-muted mb-4">Track your baby's patterns over time</Text>

        {/* Range Selector */}
        <View style={styles.rangeRow}>
          {ranges.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => {
                setRange(r.key);
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.rangeBtn,
                {
                  backgroundColor: range === r.key ? colors.primary + "20" : colors.surface,
                  borderColor: range === r.key ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: range === r.key ? colors.primary : colors.muted,
                  fontWeight: range === r.key ? "700" : "500",
                  fontSize: 13,
                }}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Feed Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Daily Feed Intake</Text>
            <Text style={[styles.chartAvg, { color: colors.feed }]}>
              Avg: {displayAmount(avgFeed)}
            </Text>
          </View>
          <BarChart
            data={feedData.map((d) => ({ day: d.day, value: d.totalMl }))}
            maxVal={maxFeed}
            color={colors.feed}
            labelFn={displayAmount}
          />
        </View>

        {/* Diaper Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Daily Diapers</Text>
            <Text style={[styles.chartAvg, { color: colors.diaper }]}>
              Avg: {avgDiaper.toFixed(1)}/day
            </Text>
          </View>
          <BarChart
            data={diaperData.map((d) => ({ day: d.day, value: d.total }))}
            maxVal={maxDiaper}
            color={colors.diaper}
            labelFn={(v) => `${v}`}
          />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.feed }]} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Avg Pee: {(diaperData.reduce((s, d) => s + d.pee, 0) / range).toFixed(1)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Avg Poo: {(diaperData.reduce((s, d) => s + d.poo, 0) / range).toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Sleep Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Daily Sleep</Text>
            <Text style={[styles.chartAvg, { color: colors.sleep }]}>
              Avg: {formatDuration(avgSleep)}
            </Text>
          </View>
          <BarChart
            data={sleepData.map((d) => ({ day: d.day, value: d.totalMin }))}
            maxVal={maxSleep}
            color={colors.sleep}
            labelFn={(v) => formatDuration(v)}
          />
        </View>

        {/* Growth Chart */}
        {state.growthHistory.length > 0 && (
          <GrowthChart entries={state.growthHistory} colors={colors} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function GrowthChart({ entries, colors }: { entries: GrowthEntry[]; colors: any }) {
  // Sort entries by date ascending
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weightEntries = sorted.filter((e) => e.weight != null);
  const heightEntries = sorted.filter((e) => e.height != null);

  const formatDate = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const LineChart = ({
    data,
    color,
    unitLabel,
  }: {
    data: { date: string; value: number }[];
    color: string;
    unitLabel: string;
  }) => {
    if (data.length === 0) return null;
    const maxVal = Math.max(...data.map((d) => d.value));
    const minVal = Math.min(...data.map((d) => d.value));
    const range = maxVal - minVal || 1;

    return (
      <View style={growthStyles.lineChartContainer}>
        {/* Y axis labels */}
        <View style={growthStyles.yAxis}>
          <Text style={[growthStyles.yLabel, { color: colors.muted }]}>
            {maxVal.toFixed(1)}
          </Text>
          <Text style={[growthStyles.yLabel, { color: colors.muted }]}>
            {((maxVal + minVal) / 2).toFixed(1)}
          </Text>
          <Text style={[growthStyles.yLabel, { color: colors.muted }]}>
            {minVal.toFixed(1)}
          </Text>
        </View>
        {/* Chart area */}
        <View style={growthStyles.chartArea}>
          {/* Grid lines */}
          <View style={[growthStyles.gridLine, { backgroundColor: colors.border + "40", top: 0 }]} />
          <View style={[growthStyles.gridLine, { backgroundColor: colors.border + "40", top: "50%" }]} />
          <View style={[growthStyles.gridLine, { backgroundColor: colors.border + "40", bottom: 0 }]} />
          {/* Data points */}
          <View style={growthStyles.pointsRow}>
            {data.map((d, i) => {
              const yPct = data.length === 1 ? 50 : ((d.value - minVal) / range) * 80 + 10;
              return (
                <View key={d.date + i} style={[growthStyles.pointColumn]}>
                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <View style={{ height: `${yPct}%`, alignItems: "center" }}>
                      <Text style={[growthStyles.pointValue, { color }]}>
                        {d.value.toFixed(1)}
                      </Text>
                      <View style={[growthStyles.dot, { backgroundColor: color }]} />
                    </View>
                  </View>
                  <Text style={[growthStyles.xLabel, { color: colors.muted }]} numberOfLines={1}>
                    {formatDate(d.date)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      {weightEntries.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Weight Over Time</Text>
            <Text style={[styles.chartAvg, { color: colors.success }]}>
              Latest: {weightEntries[weightEntries.length - 1].weight} {weightEntries[weightEntries.length - 1].weightUnit || "kg"}
            </Text>
          </View>
          <LineChart
            data={weightEntries.map((e) => ({ date: e.date, value: e.weight! }))}
            color={colors.success}
            unitLabel={weightEntries[0].weightUnit || "kg"}
          />
        </View>
      )}
      {heightEntries.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Height Over Time</Text>
            <Text style={[styles.chartAvg, { color: colors.primary }]}>
              Latest: {heightEntries[heightEntries.length - 1].height} {heightEntries[heightEntries.length - 1].heightUnit || "cm"}
            </Text>
          </View>
          <LineChart
            data={heightEntries.map((e) => ({ date: e.date, value: e.height! }))}
            color={colors.primary}
            unitLabel={heightEntries[0].heightUnit || "cm"}
          />
        </View>
      )}
    </>
  );
}

const growthStyles = StyleSheet.create({
  lineChartContainer: {
    flexDirection: "row",
    height: 140,
  },
  yAxis: {
    width: 40,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
    paddingBottom: 18,
  },
  yLabel: {
    fontSize: 9,
    fontWeight: "500",
  },
  chartArea: {
    flex: 1,
    position: "relative",
    paddingBottom: 18,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },
  pointsRow: {
    flex: 1,
    flexDirection: "row",
  },
  pointColumn: {
    flex: 1,
    alignItems: "center",
  },
  pointValue: {
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  xLabel: {
    fontSize: 8,
    marginTop: 4,
  },
});

const styles = StyleSheet.create({
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  rangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chartAvg: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartContainer: {
    height: 120,
  },
  chartBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barTrack: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: "500",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
