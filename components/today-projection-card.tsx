import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { calculateAge, getDayKey, type FeedData, type SleepData, type DiaperData, formatDuration } from "@/lib/store";
import { calculateTodayProjections, getAgeSpecificTargets } from "@/lib/ai-context-builder";

interface ProgressBarProps {
  label: string;
  emoji: string;
  logged: number;
  projected: number;
  target: number;
  unit: string;
  formatValue?: (v: number) => string;
  status: "ahead" | "on-track" | "behind";
}

function ProgressBar({ label, emoji, logged, projected, target, unit, formatValue, status }: ProgressBarProps) {
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
            {" → "}{fmt(projected)} projected
          </Text>
        </View>
      </View>

      {/* Track */}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        {/* Logged portion */}
        {loggedPct > 0 && (
          <View
            style={[
              styles.trackFill,
              { width: `${loggedPct}%` as any, backgroundColor: statusColor, borderRadius: 4 },
            ]}
          />
        )}
        {/* Projected portion (lighter) */}
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
        {/* Target marker at 100% */}
        <View style={[styles.targetMarker, { backgroundColor: colors.muted }]} />
      </View>

      {/* Target label */}
      <Text style={[styles.targetLabel, { color: colors.muted }]}>
        Target: {fmt(target)}
        {projectedPct >= 95 && projectedPct <= 115 && " ✓"}
        {projectedPct > 115 && " ↑"}
        {projectedPct < 80 && " ↓"}
      </Text>
    </View>
  );
}

export function TodayProjectionCard() {
  const colors = useColors();
  const { state } = useStore();

  if (!state.profile?.birthDate) return null;

  const ageInfo = calculateAge(state.profile.birthDate);
  const ageWeeks = Math.floor((ageInfo.months * 30 + ageInfo.days) / 7);
  const targets = getAgeSpecificTargets(ageWeeks);
  const projections = calculateTodayProjections(state.events, ageWeeks);

  const { feedingProjection, sleepProjection, diaperProjection } = projections;

  // Time remaining label
  const now = new Date();
  const hoursLeft = Math.round(feedingProjection.timeRemainingHours);
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
        logged={feedingProjection.totalLoggedMl}
        projected={feedingProjection.projectedTotalMl}
        target={feedingProjection.dailyTargetMl}
        unit=" ml"
        status={feedingProjection.status}
      />

      {/* Sleep bar */}
      <ProgressBar
        label="Sleep"
        emoji="😴"
        logged={sleepProjection.totalLoggedMinutes}
        projected={sleepProjection.projectedTotalMinutes}
        target={sleepProjection.dailyTargetMinutes}
        unit=""
        formatValue={(v) => formatDuration(Math.round(v))}
        status={sleepProjection.status}
      />

      {/* Diapers bar */}
      <ProgressBar
        label="Wet Diapers"
        emoji="🧷"
        logged={diaperProjection.wetDiapersLogged}
        projected={diaperProjection.projectedWetDiapers}
        target={diaperProjection.dailyTargetWet}
        unit=""
        formatValue={(v) => `${Math.round(v)}`}
        status={diaperProjection.wetStatus}
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
