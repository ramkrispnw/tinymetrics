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
  ozToMl,
  convertWeight,
  convertHeight,
  type FeedData,
  type SleepData,
  type DiaperData,
  type GrowthData,
  type GrowthEntry,
  type WeightUnit,
  type HeightUnit,
  type PumpData,
  getSleepMinutesForDay,
} from "@/lib/store";
import * as Haptics from "expo-haptics";
import { ChartAISummary } from "@/components/chart-ai-summary";
import {
  getWHOWeightData,
  getWHOHeightData,
  kgToLbs,
  cmToIn,
  calculateBabyPercentile,
  type PercentileRow,
} from "@/lib/who-growth-data";
import Svg, { Path, Polyline, Text as SvgText } from "react-native-svg";

type Range = 7 | 14 | 30;
type FeedUnit = "ml" | "oz";

export default function TrendsScreen() {
  const colors = useColors();
  const { state } = useStore();
  const [range, setRange] = useState<Range>(7);

  // Unit toggles for each chart
  const [feedUnit, setFeedUnit] = useState<FeedUnit>(state.settings.units);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    state.profile?.weightUnit || "kg"
  );
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(
    state.profile?.heightUnit || "cm"
  );

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

  // Feed data with unit conversion
  const feedData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "feed" && getDayKey(e.timestamp) === day
      );
      const totalMl = dayEvents.reduce(
        (sum, e) => sum + ((e.data as FeedData).amountMl || 0),
        0
      );
      // Convert to display unit
      const displayValue =
        feedUnit === "oz" ? mlToOz(totalMl) : Math.round(totalMl);
      return { day, value: displayValue, count: dayEvents.length };
    });
  }, [dateRange, state.events, feedUnit]);

  // Split pee and poo into separate data arrays
  const peeData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "diaper" && getDayKey(e.timestamp) === day
      );
      let count = 0;
      dayEvents.forEach((e) => {
        const d = e.data as DiaperData;
        if (d.type === "pee" || d.type === "both") count++;
      });
      return { day, value: count };
    });
  }, [dateRange, state.events]);

  const pooData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "diaper" && getDayKey(e.timestamp) === day
      );
      let count = 0;
      dayEvents.forEach((e) => {
        const d = e.data as DiaperData;
        if (d.type === "poo" || d.type === "both") count++;
      });
      return { day, value: count };
    });
  }, [dateRange, state.events]);

  const sleepData = useMemo(() => {
    const allSleepEvents = state.events.filter((e) => e.type === "sleep");
    return dateRange.map((day) => {
      // Sum sleep minutes that overlap with this calendar day,
      // properly splitting overnight sleep across day boundaries
      let totalMin = 0;
      let count = 0;
      for (const e of allSleepEvents) {
        const mins = getSleepMinutesForDay(e, day);
        if (mins > 0) {
          totalMin += mins;
          count++;
        }
      }
      return { day, value: totalMin, count };
    });
  }, [dateRange, state.events]);

  // Pump data with unit conversion
  const pumpData = useMemo(() => {
    return dateRange.map((day) => {
      const dayEvents = state.events.filter(
        (e) => e.type === "pump" && getDayKey(e.timestamp) === day
      );
      const totalMl = dayEvents.reduce(
        (sum, e) => sum + ((e.data as PumpData).amountMl || 0),
        0
      );
      const displayValue =
        feedUnit === "oz" ? mlToOz(totalMl) : Math.round(totalMl);
      return { day, value: displayValue, count: dayEvents.length };
    });
  }, [dateRange, state.events, feedUnit]);

  // Growth data from both growthHistory and growth events, with unit conversion
  const weightData = useMemo(() => {
    // Collect from growthHistory
    const fromHistory = state.growthHistory
      .filter((e) => e.weight != null)
      .map((e) => ({
        date: e.date,
        value: convertWeight(
          e.weight!,
          e.weightUnit || "kg",
          weightUnit
        ),
      }));
    // Collect from growth events
    const fromEvents = state.events
      .filter((e) => e.type === "growth" && (e.data as GrowthData).weight != null)
      .map((e) => {
        const gd = e.data as GrowthData;
        return {
          date: getDayKey(e.timestamp),
          value: convertWeight(
            gd.weight!,
            gd.weightUnit || "kg",
            weightUnit
          ),
        };
      });
    // Merge and deduplicate by date (keep latest)
    const map = new Map<string, { date: string; value: number }>();
    [...fromHistory, ...fromEvents].forEach((d) => map.set(d.date, d));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [state.growthHistory, state.events, weightUnit]);

  const heightData = useMemo(() => {
    const fromHistory = state.growthHistory
      .filter((e) => e.height != null)
      .map((e) => ({
        date: e.date,
        value: convertHeight(
          e.height!,
          e.heightUnit || "cm",
          heightUnit
        ),
      }));
    const fromEvents = state.events
      .filter((e) => e.type === "growth" && (e.data as GrowthData).height != null)
      .map((e) => {
        const gd = e.data as GrowthData;
        return {
          date: getDayKey(e.timestamp),
          value: convertHeight(
            gd.height!,
            gd.heightUnit || "cm",
            heightUnit
          ),
        };
      });
    const map = new Map<string, { date: string; value: number }>();
    [...fromHistory, ...fromEvents].forEach((d) => map.set(d.date, d));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [state.growthHistory, state.events, heightUnit]);

  const maxFeed = Math.max(...feedData.map((d) => d.value), 1);
  const maxPee = Math.max(...peeData.map((d) => d.value), 1);
  const maxPoo = Math.max(...pooData.map((d) => d.value), 1);
  const maxSleep = Math.max(...sleepData.map((d) => d.value), 1);
  const maxPump = Math.max(...pumpData.map((d) => d.value), 1);

  const hasFeedData = feedData.some((d) => d.value > 0);
  const hasPeeData = peeData.some((d) => d.value > 0);
  const hasPooData = pooData.some((d) => d.value > 0);
  const hasSleepData = sleepData.some((d) => d.value > 0);
  const hasPumpData = pumpData.some((d) => d.value > 0);

  const avgFeed = feedData.reduce((s, d) => s + d.value, 0) / range;
  const avgPee = peeData.reduce((s, d) => s + d.value, 0) / range;
  const avgPoo = pooData.reduce((s, d) => s + d.value, 0) / range;
  const avgSleep = sleepData.reduce((s, d) => s + d.value, 0) / range;
  const avgPump = pumpData.reduce((s, d) => s + d.value, 0) / range;

  const displayFeedAmount = (v: number) => {
    return feedUnit === "oz" ? `${v.toFixed(1)} oz` : `${Math.round(v)} ml`;
  };

  const formatDayLabel = (day: string) => {
    const d = new Date(day + "T12:00:00");
    return d.toLocaleDateString([], { weekday: "short" }).slice(0, 2);
  };

  const formatFullDate = (day: string) => {
    const d = new Date(day + "T12:00:00");
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const ranges: { key: Range; label: string }[] = [
    { key: 7, label: "7 Days" },
    { key: 14, label: "14 Days" },
    { key: 30, label: "30 Days" },
  ];

  // Compute trend line (simple linear regression)
  function computeTrendLine(values: number[]): number[] {
    const n = values.length;
    if (n < 2) return values;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return values.map((_, i) => Math.max(0, intercept + slope * i));
  }

  // Unit toggle component
  const UnitToggle = ({
    options,
    selected,
    onSelect,
  }: {
    options: { key: string; label: string }[];
    selected: string;
    onSelect: (key: string) => void;
  }) => (
    <View style={styles.unitToggleRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => {
            onSelect(opt.key);
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.unitToggleBtn,
            {
              backgroundColor:
                selected === opt.key
                  ? colors.primary + "20"
                  : colors.surface,
              borderColor:
                selected === opt.key ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color:
                selected === opt.key ? colors.primary : colors.muted,
              fontWeight: selected === opt.key ? "700" : "500",
              fontSize: 11,
            }}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const EmptyChartState = ({ emoji, label }: { emoji: string; label: string }) => (
    <View style={[styles.emptyChartCard, { borderColor: colors.border }]}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", marginTop: 6 }}>
        No {label} data yet
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, textAlign: "center" }}>
        Log your first session to see trends here
      </Text>
    </View>
  );

  const BarChart = ({
    data,
    maxVal,
    color,
    labelFn,
    avgVal,
    trendValues,
  }: {
    data: { day: string; value: number }[];
    maxVal: number;
    color: string;
    labelFn: (v: number) => string;
    avgVal: number;
    trendValues: number[];
  }) => {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const avgPct = maxVal > 0 ? (avgVal / maxVal) * 100 : 0;

    return (
      <View style={styles.chartContainer}>
        {/* Selected bar tooltip */}
        {selectedIdx !== null && (
          <View
            style={[
              styles.tooltip,
              { backgroundColor: color + "20", borderColor: color },
            ]}
          >
            <Text style={[styles.tooltipText, { color }]}>
              {formatFullDate(data[selectedIdx].day)}:{" "}
              {labelFn(data[selectedIdx].value)}
            </Text>
          </View>
        )}
        <View style={styles.chartBars}>
          {data.map((d, i) => {
            const height = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            const trendHeight =
              maxVal > 0 ? (trendValues[i] / maxVal) * 100 : 0;
            const isSelected = selectedIdx === i;
            return (
              <Pressable
                key={d.day}
                style={styles.barColumn}
                onPress={() => {
                  setSelectedIdx(isSelected ? null : i);
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: colors.border + "30" },
                  ]}
                >
                  {/* Trend line marker */}
                  <View
                    style={[
                      styles.trendMarker,
                      {
                        bottom: `${Math.min(trendHeight, 98)}%`,
                        backgroundColor: color + "80",
                      },
                    ]}
                  />
                  {/* Avg line */}
                  <View
                    style={[
                      styles.avgLine,
                      {
                        bottom: `${Math.min(avgPct, 98)}%`,
                        backgroundColor: colors.muted + "50",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: isSelected ? color : color + "CC",
                        height: `${Math.max(height, d.value > 0 ? 4 : 1)}%`,
                        opacity: isSelected ? 1 : 0.85,
                      },
                    ]}
                  />
                </View>
                {/* Value label on tap */}
                {isSelected && d.value > 0 && (
                  <Text
                    style={[styles.barValueLabel, { color }]}
                    numberOfLines={1}
                  >
                    {labelFn(d.value)}
                  </Text>
                )}
                {range <= 14 && (
                  <Text
                    style={[
                      styles.barLabel,
                      {
                        color: isSelected ? color : colors.muted,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {formatDayLabel(d.day)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {/* Trend direction indicator */}
        {trendValues.length >= 2 && (
          <View style={styles.trendIndicator}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              Trend:{" "}
              {trendValues[trendValues.length - 1] > trendValues[0]
                ? "↑ Increasing"
                : trendValues[trendValues.length - 1] < trendValues[0]
                ? "↓ Decreasing"
                : "→ Stable"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const feedTrend = computeTrendLine(feedData.map((d) => d.value));
  const peeTrend = computeTrendLine(peeData.map((d) => d.value));
  const pooTrend = computeTrendLine(pooData.map((d) => d.value));
  const sleepTrend = computeTrendLine(sleepData.map((d) => d.value));
  const pumpTrend = computeTrendLine(pumpData.map((d) => d.value));

  return (
    <ScreenContainer className="px-4 pt-2">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text className="text-2xl font-bold text-foreground mb-1">Trends</Text>
        <Text className="text-sm text-muted mb-4">
          Track your baby's patterns over time
        </Text>

        {/* Range Selector */}
        <View style={styles.rangeRow}>
          {ranges.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => {
                setRange(r.key);
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.rangeBtn,
                {
                  backgroundColor:
                    range === r.key
                      ? colors.primary + "20"
                      : colors.surface,
                  borderColor:
                    range === r.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    range === r.key ? colors.primary : colors.muted,
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
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              🍼 Daily Feed Intake
            </Text>
            <Text style={[styles.chartAvg, { color: colors.feed }]}>
              Avg: {displayFeedAmount(avgFeed)}
            </Text>
          </View>
          {hasFeedData ? (
            <>
              <UnitToggle
                options={[
                  { key: "ml", label: "ml" },
                  { key: "oz", label: "oz" },
                ]}
                selected={feedUnit}
                onSelect={(k) => setFeedUnit(k as FeedUnit)}
              />
              <BarChart
                data={feedData}
                maxVal={maxFeed}
                color={colors.feed}
                labelFn={displayFeedAmount}
                avgVal={avgFeed}
                trendValues={feedTrend}
              />
              <ChartAISummary
                chartType="Daily Feed Intake"
                dataJson={JSON.stringify(feedData.map(d => ({ day: d.day, value: d.value, unit: feedUnit })))}
              />
            </>
          ) : (
            <EmptyChartState emoji="🍼" label="feeding" />
          )}
        </View>

        {/* Pee Diaper Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              💧 Wet Diapers (Pee)
            </Text>
            <Text style={[styles.chartAvg, { color: colors.feed }]}>
              Avg: {avgPee.toFixed(1)}/day
            </Text>
          </View>
          {hasPeeData ? (
            <>
              <BarChart
                data={peeData}
                maxVal={maxPee}
                color={colors.feed}
                labelFn={(v) => `${v}`}
                avgVal={avgPee}
                trendValues={peeTrend}
              />
              <ChartAISummary
                chartType="Wet Diapers (Pee) per Day"
                dataJson={JSON.stringify(peeData.map(d => ({ day: d.day, count: d.value })))}
              />
            </>
          ) : (
            <EmptyChartState emoji="💧" label="wet diaper" />
          )}
        </View>

        {/* Poo Diaper Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              💩 Poo Diapers
            </Text>
            <Text style={[styles.chartAvg, { color: colors.warning }]}>
              Avg: {avgPoo.toFixed(1)}/day
            </Text>
          </View>
          {hasPooData ? (
            <>
              <BarChart
                data={pooData}
                maxVal={maxPoo}
                color={colors.warning}
                labelFn={(v) => `${v}`}
                avgVal={avgPoo}
                trendValues={pooTrend}
              />
              <ChartAISummary
                chartType="Poo Diapers per Day"
                dataJson={JSON.stringify(pooData.map(d => ({ day: d.day, count: d.value })))}
              />
            </>
          ) : (
            <EmptyChartState emoji="💩" label="poo diaper" />
          )}
        </View>

        {/* Sleep Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              😴 Daily Sleep
            </Text>
            <Text style={[styles.chartAvg, { color: colors.sleep }]}>
              Avg: {formatDuration(avgSleep)}
            </Text>
          </View>
          {hasSleepData ? (
            <>
              <BarChart
                data={sleepData}
                maxVal={maxSleep}
                color={colors.sleep}
                labelFn={(v) => formatDuration(v)}
                avgVal={avgSleep}
                trendValues={sleepTrend}
              />
              <ChartAISummary
                chartType="Daily Sleep Duration"
                dataJson={JSON.stringify(sleepData.map(d => ({ day: d.day, minutes: d.value })))}
              />
            </>
          ) : (
            <EmptyChartState emoji="😴" label="sleep" />
          )}
        </View>

        {/* Pump Output Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              🤱 Pump Output
            </Text>
            <Text style={[styles.chartAvg, { color: colors.pump }]}>
              Avg: {displayFeedAmount(avgPump)}
            </Text>
          </View>
          {hasPumpData ? (
            <>
              <UnitToggle
                options={[
                  { key: "ml", label: "ml" },
                  { key: "oz", label: "oz" },
                ]}
                selected={feedUnit}
                onSelect={(k) => setFeedUnit(k as FeedUnit)}
              />
              <BarChart
                data={pumpData}
                maxVal={maxPump}
                color={colors.pump}
                labelFn={displayFeedAmount}
                avgVal={avgPump}
                trendValues={pumpTrend}
              />
              <ChartAISummary
                chartType="Daily Pump Output"
                dataJson={JSON.stringify(pumpData.map(d => ({ day: d.day, value: d.value, unit: feedUnit })))}
              />
            </>
          ) : (
            <EmptyChartState emoji="🤱" label="pump" />
          )}
        </View>

        {/* Weight Chart */}
        {weightData.length > 0 && (
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.chartHeader}>
              <Text
                style={[styles.chartTitle, { color: colors.foreground }]}
              >
                ⚖️ Weight Over Time
              </Text>
              <Text style={[styles.chartAvg, { color: colors.success }]}>
                Latest: {weightData[weightData.length - 1].value.toFixed(1)}{" "}
                {weightUnit}
              </Text>
            </View>
            <UnitToggle
              options={[
                { key: "kg", label: "kg" },
                { key: "lbs", label: "lbs" },
              ]}
              selected={weightUnit}
              onSelect={(k) => setWeightUnit(k as WeightUnit)}
            />
            <LineChart
              data={weightData}
              color={colors.success}
              unitLabel={weightUnit}
              colors={colors}
              whoData={getWHOWeightData(state.profile?.sex)}
              whoConvert={weightUnit === "lbs" ? kgToLbs : undefined}
              birthDate={state.profile?.birthDate}
            />
            <ChartAISummary
              chartType="Weight Over Time"
              dataJson={JSON.stringify(weightData.map(d => ({ date: d.date, value: d.value, unit: weightUnit })))}
            />
          </View>
        )}

        {/* Height Chart */}
        {heightData.length > 0 && (
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.chartHeader}>
              <Text
                style={[styles.chartTitle, { color: colors.foreground }]}
              >
                📏 Height Over Time
              </Text>
              <Text style={[styles.chartAvg, { color: colors.primary }]}>
                Latest: {heightData[heightData.length - 1].value.toFixed(1)}{" "}
                {heightUnit}
              </Text>
            </View>
            <UnitToggle
              options={[
                { key: "cm", label: "cm" },
                { key: "in", label: "in" },
              ]}
              selected={heightUnit}
              onSelect={(k) => setHeightUnit(k as HeightUnit)}
            />
            <LineChart
              data={heightData}
              color={colors.primary}
              unitLabel={heightUnit}
              colors={colors}
              whoData={getWHOHeightData(state.profile?.sex)}
              whoConvert={heightUnit === "in" ? cmToIn : undefined}
              birthDate={state.profile?.birthDate}
            />
            <ChartAISummary
              chartType="Height Over Time"
              dataJson={JSON.stringify(heightData.map(d => ({ date: d.date, value: d.value, unit: heightUnit })))}
            />
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const COL_WIDTH = 32;

type WHOPoint = { p3: number | null; p15: number | null; p50: number | null; p85: number | null; p97: number | null } | null;

function toY(v: number, chartH: number, minVal: number, rangeVal: number): number {
  return chartH - ((v - minVal) / rangeVal) * chartH * 0.8 - chartH * 0.1;
}

function buildLinePoints(whoPoints: WHOPoint[], key: "p3" | "p15" | "p50" | "p85" | "p97", chartH: number, minVal: number, rangeVal: number): string {
  return whoPoints
    .map((p, i) => {
      if (!p) return null;
      const v = p[key];
      if (v === null) return null;
      return `${i * COL_WIDTH + COL_WIDTH / 2},${toY(v, chartH, minVal, rangeVal)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function buildBandPath(whoPoints: WHOPoint[], upperKey: "p85" | "p97", lowerKey: "p3" | "p15", chartH: number, minVal: number, rangeVal: number): string {
  const upper: string[] = [];
  const lower: string[] = [];
  whoPoints.forEach((p, i) => {
    if (!p) return;
    const uv = p[upperKey];
    const lv = p[lowerKey];
    if (uv === null || lv === null) return;
    const x = i * COL_WIDTH + COL_WIDTH / 2;
    upper.push(`${x},${toY(uv, chartH, minVal, rangeVal)}`);
    lower.push(`${x},${toY(lv, chartH, minVal, rangeVal)}`);
  });
  if (upper.length === 0) return "";
  return `M${upper[0]} ${upper.slice(1).map((p) => `L${p}`).join(" ")} ${lower.reverse().map((p, i) => `${i === 0 ? "L" : "L"}${p}`).join(" ")} Z`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Reusable line chart for growth data
function LineChart({
  data,
  color,
  unitLabel,
  colors,
  whoData,
  whoConvert,
  birthDate,
}: {
  data: { date: string; value: number }[];
  color: string;
  unitLabel: string;
  colors: any;
  whoData?: PercentileRow[];
  whoConvert?: (v: number) => number;
  birthDate?: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Calculate baby age in months for each data point to map to WHO data
  const getMonthAge = (dateStr: string): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate + "T00:00:00");
    const d = new Date(dateStr + "T00:00:00");
    const months = (d.getFullYear() - birth.getFullYear()) * 12 + (d.getMonth() - birth.getMonth());
    return Math.max(0, Math.min(24, months));
  };

  // Get WHO percentile value for a given month
  const getWHOValue = (month: number, percentile: keyof PercentileRow): number | null => {
    if (!whoData) return null;
    const row = whoData.find((r) => r.month === Math.round(month));
    if (!row) return null;
    const val = row[percentile] as number;
    return whoConvert ? whoConvert(val) : val;
  };

  // Calculate current percentile for the latest data point (must be before early return)
  const latestPercentile = useMemo(() => {
    if (!whoData || !birthDate || data.length === 0) return null;
    const lastPoint = data[data.length - 1];
    const m = getMonthAge(lastPoint.date);
    if (m === null) return null;
    return calculateBabyPercentile(lastPoint.value, m, whoData, whoConvert);
  }, [whoData, birthDate, data, whoConvert]);

  if (data.length === 0) return null;

  // Include WHO range in min/max calculation
  let allValues = data.map((d) => d.value);
  if (whoData && birthDate) {
    data.forEach((d) => {
      const m = getMonthAge(d.date);
      if (m !== null) {
        const p3 = getWHOValue(m, "p3");
        const p97 = getWHOValue(m, "p97");
        if (p3 !== null) allValues.push(p3);
        if (p97 !== null) allValues.push(p97);
      }
    });
  }

  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const rangeVal = maxVal - minVal || 1;

  const formatDate = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Show at most ~8 date labels on the x-axis regardless of data density
  const dateStep = Math.max(1, Math.ceil(data.length / 8));

  // Pre-compute WHO percentile values at each data point's age
  const chartH = 122;
  const whoPoints: WHOPoint[] = data.map((d) => {
    const m = getMonthAge(d.date);
    if (m === null) return null;
    return {
      p3: getWHOValue(m, "p3"),
      p15: getWHOValue(m, "p15"),
      p50: getWHOValue(m, "p50"),
      p85: getWHOValue(m, "p85"),
      p97: getWHOValue(m, "p97"),
    };
  });
  const hasWHOCurves = whoData && birthDate && whoPoints.some((p) => p !== null);
  const svgWidth = data.length * COL_WIDTH;

  return (
    <View>
      {selectedIdx !== null && (
        <View
          style={[
            styles.tooltip,
            { backgroundColor: color + "20", borderColor: color },
          ]}
        >
          <Text style={[styles.tooltipText, { color }]}>
            {formatDate(data[selectedIdx].date)}:{" "}
            {data[selectedIdx].value.toFixed(1)} {unitLabel}
          </Text>
        </View>
      )}
      <View style={growthStyles.lineChartContainer}>
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
        <View style={growthStyles.chartArea}>
          <View
            style={[
              growthStyles.gridLine,
              { backgroundColor: colors.border + "40", top: 0 },
            ]}
          />
          <View
            style={[
              growthStyles.gridLine,
              { backgroundColor: colors.border + "40", top: "50%" },
            ]}
          />
          <View
            style={[
              growthStyles.gridLine,
              { backgroundColor: colors.border + "40", bottom: 0 },
            ]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={growthStyles.pointsRow}>
            {/* WHO Percentile curves - SVG overlay behind data dots */}
            {hasWHOCurves && (
              <View style={{ position: "absolute", left: 0, top: 0, width: svgWidth, height: chartH }} pointerEvents="none">
                <Svg width={svgWidth} height={chartH}>
                  {/* 3rd-97th percentile band */}
                  <Path d={buildBandPath(whoPoints, "p97", "p3", chartH, minVal, rangeVal)} fill={color + "10"} />
                  {/* 15th-85th percentile band */}
                  <Path d={buildBandPath(whoPoints, "p85", "p15", chartH, minVal, rangeVal)} fill={color + "15"} />
                  {/* p97 dashed line */}
                  <Polyline points={buildLinePoints(whoPoints, "p97", chartH, minVal, rangeVal)} stroke={color + "25"} strokeWidth={0.5} fill="none" strokeDasharray="3,3" />
                  {/* p50 center line */}
                  <Polyline points={buildLinePoints(whoPoints, "p50", chartH, minVal, rangeVal)} stroke={color + "40"} strokeWidth={1} fill="none" />
                  {/* p3 dashed line */}
                  <Polyline points={buildLinePoints(whoPoints, "p3", chartH, minVal, rangeVal)} stroke={color + "25"} strokeWidth={0.5} fill="none" strokeDasharray="3,3" />
                  {/* Labels at the right edge */}
                  {(() => {
                    const last = whoPoints[whoPoints.length - 1];
                    if (!last || last.p97 === null || last.p50 === null || last.p3 === null) return null;
                    return (
                      <>
                        <SvgText x={svgWidth - 4} y={toY(last.p97, chartH, minVal, rangeVal) - 3} fontSize={7} fill={color + "60"} textAnchor="end">97th</SvgText>
                        <SvgText x={svgWidth - 4} y={toY(last.p50, chartH, minVal, rangeVal) - 3} fontSize={7} fill={color + "80"} textAnchor="end" fontWeight="600">50th</SvgText>
                        <SvgText x={svgWidth - 4} y={toY(last.p3, chartH, minVal, rangeVal) + 10} fontSize={7} fill={color + "60"} textAnchor="end">3rd</SvgText>
                      </>
                    );
                  })()}
                </Svg>
              </View>
            )}
            {data.map((d, i) => {
              const yPct =
                data.length === 1
                  ? 50
                  : ((d.value - minVal) / rangeVal) * 80 + 10;
              const isSelected = selectedIdx === i;
              const showDate = isSelected || i % dateStep === 0;
              return (
                <Pressable
                  key={d.date + i}
                  style={growthStyles.pointColumn}
                  onPress={() => {
                    setSelectedIdx(isSelected ? null : i);
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                  }}
                >
                  <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <View
                      style={{ height: `${yPct}%`, alignItems: "center" }}
                    >
                      {isSelected && (
                        <Text
                          style={[
                            growthStyles.pointValue,
                            { color, fontWeight: "800", fontSize: 11 },
                          ]}
                        >
                          {d.value.toFixed(1)}
                        </Text>
                      )}
                      <View
                        style={[
                          growthStyles.dot,
                          {
                            backgroundColor: color,
                            width: isSelected ? 10 : 8,
                            height: isSelected ? 10 : 8,
                            borderRadius: isSelected ? 5 : 4,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text
                    style={[
                      growthStyles.xLabel,
                      {
                        color: isSelected ? color : colors.muted,
                        fontWeight: isSelected ? "700" : "400",
                        opacity: showDate ? 1 : 0,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {showDate ? formatDate(d.date) : " "}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
      {latestPercentile !== null && (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
          <Text style={{ fontSize: 11, color: color + "CC" }}>
            Currently at the {ordinal(latestPercentile)} percentile
          </Text>
        </View>
      )}
    </View>
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
    flexDirection: "row",
  },
  pointColumn: {
    width: COL_WIDTH,
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
  emptyChartCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chartAvg: {
    fontSize: 12,
    fontWeight: "600",
  },
  unitToggleRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  unitToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartContainer: {
    minHeight: 130,
  },
  chartBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    minHeight: 100,
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
    position: "relative",
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
  barValueLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
  tooltip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    alignSelf: "center",
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  trendMarker: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    zIndex: 1,
  },
  avgLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
  trendIndicator: {
    alignItems: "flex-end",
    marginTop: 4,
  },
});
