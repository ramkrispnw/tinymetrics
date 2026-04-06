import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  calculateAge,
  formatDuration,
} from "@/lib/store";
import { calculateProjections, get7DayFeedingHistory } from "@/lib/projections";


// ── Progress Bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  label: string;
  emoji: string;
  logged: number;
  projected: number;
  target: number;
  unit: string;
  formatValue?: (v: number) => string;
  status: "ahead" | "on-track" | "behind";
  basedOnHistory?: boolean;
}

function ProgressBar({ label, emoji, logged, projected, target, unit, formatValue, status, basedOnHistory }: ProgressBarProps) {
  const colors = useColors();

  const loggedPct = Math.min((logged / target) * 100, 100);
  const projectedPct = Math.min((projected / target) * 100, 100);
  const remainingPct = Math.max(projectedPct - loggedPct, 0);

  const statusColor =
    status === "ahead" ? colors.success :
    status === "behind" ? colors.error :
    colors.primary;

  const fmt = formatValue ?? ((v: number) => `${Math.round(v)}${unit}`);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: colors.foreground }]}>
          {emoji} {label}
        </Text>
        <View style={styles.barValues}>
          <Text style={[styles.loggedValue, { color: colors.foreground }]}>
            {fmt(logged)}
          </Text>
          <Text style={[styles.projectedValue, { color: colors.muted }]}>
            {" → "}{fmt(projected)}{basedOnHistory ? " (hist.)" : " projected"}
          </Text>
        </View>
      </View>

      {/* Track */}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        {loggedPct > 0 && (
          <View
            style={[
              styles.trackFill,
              { width: `${loggedPct}%` as any, backgroundColor: statusColor, borderRadius: 4 },
            ]}
          />
        )}
        {remainingPct > 0 && (
          <View
            style={[
              styles.trackProjected,
              {
                left: `${loggedPct}%` as any,
                width: `${remainingPct}%` as any,
                backgroundColor: statusColor + "40",
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              },
            ]}
          />
        )}
        <View style={[styles.targetMarker, { backgroundColor: colors.muted }]} />
      </View>

      <Text style={[styles.targetLabel, { color: colors.muted }]}>
        Target: {fmt(target)}
        {projectedPct >= 95 && projectedPct <= 115 && " ✓"}
        {projectedPct > 115 && " ↑"}
        {projectedPct < 80 && " ↓"}
      </Text>
    </View>
  );
}

// ── Feeding Sparkline (7 days) ────────────────────────────────────────────────

interface SparklineProps {
  /** ml per day for the last 7 days, index 0 = 6 days ago, index 6 = today */
  dailyMl: number[];
  /** today's projected total (replaces today's actual in the bar) */
  todayProjected: number;
  dailyTarget: number;
}

function FeedingSparkline({ dailyMl, todayProjected, dailyTarget }: SparklineProps) {
  const colors = useColors();
  const BARS = 7;
  const BAR_HEIGHT = 36;
  const values = [...dailyMl.slice(0, 6), todayProjected]; // last 6 actual + today projected
  const maxVal = Math.max(dailyTarget * 1.2, ...values, 1);

  const dayLabels = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"];

  return (
    <View style={styles.sparklineContainer}>
      <View style={styles.sparklineHeader}>
        <Text style={[styles.sparklineTitle, { color: colors.foreground }]}>
          7-Day Feeding
        </Text>
        <View style={styles.sparklineLegend}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Actual</Text>
          <View style={[styles.legendDot, { backgroundColor: colors.warning, marginLeft: 8 }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Today (proj.)</Text>
        </View>
      </View>

      {/* Target dashed line label */}
      <Text style={[styles.sparklineTargetLabel, { color: colors.muted }]}>
        Target: {dailyTarget}ml
      </Text>

      {/* Bar chart */}
      <View style={styles.sparklineBars}>
        {values.map((val, i) => {
          const isToday = i === BARS - 1;
          const heightPct = val > 0 ? (val / maxVal) * BAR_HEIGHT : 2;
          const targetHeightPct = (dailyTarget / maxVal) * BAR_HEIGHT;
          const barColor = isToday ? colors.warning : colors.primary;
          const atTarget = val >= dailyTarget * 0.9 && val <= dailyTarget * 1.15;
          const below = val < dailyTarget * 0.9 && val > 0;

          return (
            <View key={i} style={styles.sparklineBarWrapper}>
              {/* Bar column */}
              <View style={[styles.sparklineBarTrack, { height: BAR_HEIGHT }]}>
                {/* Target line indicator */}
                <View
                  style={[
                    styles.sparklineTargetLine,
                    {
                      bottom: targetHeightPct,
                      backgroundColor: colors.border,
                    },
                  ]}
                />
                {/* Actual bar */}
                {val > 0 && (
                  <View
                    style={[
                      styles.sparklineBar,
                      {
                        height: heightPct,
                        backgroundColor: below
                          ? colors.error + "CC"
                          : atTarget
                          ? colors.success + "CC"
                          : barColor + "CC",
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      },
                    ]}
                  />
                )}
                {/* No data placeholder */}
                {val === 0 && (
                  <View
                    style={[
                      styles.sparklineBar,
                      { height: 3, backgroundColor: colors.border },
                    ]}
                  />
                )}
              </View>
              {/* Day label */}
              <Text
                style={[
                  styles.sparklineDayLabel,
                  {
                    color: isToday ? colors.primary : colors.muted,
                    fontWeight: isToday ? "700" : "400",
                  },
                ]}
              >
                {dayLabels[i]}
              </Text>
              {/* ml label */}
              {val > 0 && (
                <Text style={[styles.sparklineMlLabel, { color: isToday ? colors.warning : colors.muted }]}>
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}L` : `${Math.round(val)}`}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={[styles.sparklineNote, { color: colors.muted }]}>
        Green = on target · Red = below target · Orange = today's projection
      </Text>
    </View>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function TodayProjectionCard() {
  const colors = useColors();
  const { state } = useStore();

  if (!state.profile?.birthDate) return null;

  const ageInfo = calculateAge(state.profile.birthDate);
  const ageWeeks = Math.floor((ageInfo.months * 30 + ageInfo.days) / 7);

  // Convert weight to kg for personalized targets
  const currentWeightKg = state.profile.weight
    ? state.profile.weightUnit === "lbs"
      ? state.profile.weight * 0.453592
      : state.profile.weight
    : undefined;
  const birthWeightKg = state.profile.birthWeight
    ? state.profile.birthWeightUnit === "lbs"
      ? state.profile.birthWeight * 0.453592
      : state.profile.birthWeight
    : undefined;

  const proj = calculateProjections(state.events, ageWeeks, currentWeightKg, birthWeightKg);

  // 7-day sparkline: 6 historical days + today projected
  const sparklineValues = get7DayFeedingHistory(state.events, proj.feeding.projected);

  // Time remaining label
  const hoursLeft = Math.round(proj.hoursRemaining);
  const timeLabel = hoursLeft <= 1 ? "< 1h left today" : `${hoursLeft}h left today`;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Progress</Text>
        <Text style={[styles.timeLabel, { color: colors.muted }]}>{timeLabel}</Text>
      </View>

      {/* Feeding bar */}
      <ProgressBar
        label="Feeding"
        emoji="🍼"
        logged={proj.feeding.logged}
        projected={proj.feeding.projected}
        target={proj.feeding.target}
        unit=" ml"
        status={proj.feeding.status}
        basedOnHistory={proj.feeding.basedOnHistory}
      />

      {/* Sleep bar */}
      <ProgressBar
        label="Sleep"
        emoji="😴"
        logged={proj.sleep.logged}
        projected={proj.sleep.projected}
        target={proj.sleep.target}
        unit=""
        formatValue={(v) => formatDuration(Math.round(v))}
        status={proj.sleep.status}
        basedOnHistory={proj.sleep.basedOnHistory}
      />

      {/* Wet Diapers bar */}
      <ProgressBar
        label="Wet Diapers"
        emoji="💧"
        logged={proj.wetDiapers.logged}
        projected={proj.wetDiapers.projected}
        target={proj.wetDiapers.target}
        unit=""
        formatValue={(v) => `${Math.round(v)}`}
        status={proj.wetDiapers.status}
        basedOnHistory={proj.wetDiapers.basedOnHistory}
      />

      {/* Poopy Diapers bar */}
      <ProgressBar
        label="Poopy Diapers"
        emoji="💩"
        logged={proj.poopyDiapers.logged}
        projected={proj.poopyDiapers.projected}
        target={proj.poopyDiapers.target}
        unit=""
        formatValue={(v) => `${Math.round(v)}`}
        status={proj.poopyDiapers.status}
        basedOnHistory={proj.poopyDiapers.basedOnHistory}
      />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 7-day Feeding Sparkline */}
      <FeedingSparkline
        dailyMl={sparklineValues}
        todayProjected={proj.feeding.projected}
        dailyTarget={proj.feeding.target}
      />

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Logged</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary + "40" }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Projected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
          <Text style={[styles.legendText, { color: colors.muted }]}>Target</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  timeLabel: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  // ── Progress Bar ──
  barContainer: {
    gap: 4,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  barValues: {
    flexDirection: "row",
    alignItems: "center",
  },
  loggedValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  projectedValue: {
    fontSize: 11,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  trackFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
  },
  trackProjected: {
    position: "absolute",
    top: 0,
    height: "100%",
  },
  targetMarker: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 2,
    height: "100%",
  },
  targetLabel: {
    fontSize: 11,
    textAlign: "right",
  },
  // ── Sparkline ──
  sparklineContainer: {
    gap: 6,
  },
  sparklineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sparklineTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  sparklineLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sparklineTargetLabel: {
    fontSize: 10,
    textAlign: "right",
  },
  sparklineBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 4,
  },
  sparklineBarWrapper: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  sparklineBarTrack: {
    width: "80%",
    justifyContent: "flex-end",
    position: "relative",
  },
  sparklineTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },
  sparklineBar: {
    width: "100%",
  },
  sparklineDayLabel: {
    fontSize: 9,
    textAlign: "center",
  },
  sparklineMlLabel: {
    fontSize: 8,
    textAlign: "center",
  },
  sparklineNote: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
  // ── Legend ──
  legend: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 4,
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
  legendText: {
    fontSize: 11,
  },
});
