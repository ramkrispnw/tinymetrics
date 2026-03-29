/**
 * Mock screen: Inline AI Insights
 *
 * Shows every variant in context — what they'd look like
 * embedded in Home, the event log, and Trends.
 *
 * Navigate to this screen with router.push("/ai-insights-demo")
 * or open it directly in Expo Go.
 */
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { InlineAIInsight } from "@/components/inline-ai-insight";
import { useColors } from "@/hooks/use-colors";

function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.muted }]}>{children}</Text>
  );
}

/** Thin skeleton of a summary card row, matching the real Home screen */
function MockSummaryRow() {
  const colors = useColors();
  const cards = [
    { icon: "fork.knife" as const, value: "520 ml", label: "Feed", color: colors.feed },
    { icon: "drop.fill" as const, value: "4P / 2💩", label: "Diapers", color: colors.diaper },
    { icon: "moon.fill" as const, value: "3h 40m", label: "Sleep", color: colors.sleep },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
      {cards.map((c) => (
        <View
          key={c.label}
          style={[
            styles.summaryCard,
            { backgroundColor: c.color + "15", borderColor: c.color + "30", flex: 1 },
          ]}
        >
          <IconSymbol name={c.icon} size={16} color={c.color} />
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{c.value}</Text>
          <Text style={[styles.summarySubLabel, { color: colors.muted }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Thin skeleton of a chart bar row */
function MockChartBar({ day, pct, color }: { day: string; pct: number; color: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", flex: 1, gap: 4 }}>
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { height: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barLabel, { color: colors.muted }]}>{day}</Text>
    </View>
  );
}

function MockBarChart({ color }: { color: string }) {
  const days = [
    { day: "Mon", pct: 70 },
    { day: "Tue", pct: 85 },
    { day: "Wed", pct: 60 },
    { day: "Thu", pct: 90 },
    { day: "Fri", pct: 55 },
    { day: "Sat", pct: 40 },
    { day: "Sun", pct: 45 },
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 80 }}>
      {days.map((d) => (
        <MockChartBar key={d.day} day={d.day} pct={d.pct} color={color} />
      ))}
    </View>
  );
}

/** Thin skeleton of an event list item */
function MockEventRow({
  icon,
  title,
  summary,
  time,
  color,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  title: string;
  summary: string;
  time: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.eventIcon, { backgroundColor: color + "15" }]}>
        <IconSymbol name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.eventTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.eventSummary, { color: colors.muted }]}>{summary}</Text>
      </View>
      <Text style={[styles.eventTime, { color: colors.muted }]}>{time}</Text>
    </View>
  );
}

export default function AIInsightsDemoScreen() {
  const colors = useColors();

  return (
    <ScreenContainer className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          Inline AI Insights — Mock
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
          Four variants shown in realistic screen contexts
        </Text>

        {/* ─── 1. NUDGE — Home screen, below summary cards ─── */}
        <SectionLabel>1 · Nudge  ·  Home screen · below summary cards</SectionLabel>
        <MockSummaryRow />
        <InlineAIInsight
          variant="nudge"
          dismissible
          text="Based on the last 7 days, Oliver typically feeds around this time. Next feed window opens in ~35 min."
          actionLabel="Log feed early"
          onAction={() => {}}
        />

        <View style={styles.divider} />

        {/* ─── 2. ALERT — Home screen, no recent diaper ─── */}
        <SectionLabel>2 · Alert  ·  Home screen · unusual gap detected</SectionLabel>
        <InlineAIInsight
          variant="alert"
          dismissible
          text="No diaper logged in 6 hours — outside Oliver's usual pattern of every 2–3 h."
          actionLabel="Log diaper now"
          onAction={() => {}}
        />

        <View style={styles.divider} />

        {/* ─── 3. CELEBRATION — After logging a sleep event ─── */}
        <SectionLabel>3 · Celebration  ·  Below a just-logged sleep event</SectionLabel>
        <MockEventRow
          icon="moon.fill"
          title="Sleep"
          summary="4h 20m · 9:15 PM – 1:35 AM"
          time="just now"
          color={colors.sleep}
        />
        <View style={{ marginTop: 6 }}>
          <InlineAIInsight
            variant="celebration"
            text="Oliver's longest sleep stretch this week! Up from a 3h average. You might be turning a corner."
          />
        </View>

        <View style={styles.divider} />

        {/* ─── 4. TREND — Trends screen, above a feed chart ─── */}
        <SectionLabel>4 · Trend  ·  Trends screen · above feed chart</SectionLabel>
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>
            Daily Feed Volume
          </Text>
          <InlineAIInsight
            variant="trend"
            text="Feeding volume is down 12% this week. Normal at this age as solids increase — total calories are stable."
          />
          <View style={{ marginTop: 12 }}>
            <MockBarChart color={colors.feed} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* ─── All four side by side (reference) ─── */}
        <SectionLabel>All four variants · reference</SectionLabel>
        <View style={{ gap: 8 }}>
          <InlineAIInsight variant="nudge" text="Next feed window opens in ~35 min based on today's pattern." />
          <InlineAIInsight variant="alert" text="No diaper logged in 6 hours — outside the usual pattern." />
          <InlineAIInsight variant="celebration" text="Oliver's longest sleep stretch this week!" />
          <InlineAIInsight variant="trend" text="Feeding volume is down 12% vs last week." />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "transparent",
    marginVertical: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  summaryCard: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  summarySubLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  eventSummary: {
    fontSize: 12,
  },
  eventTime: {
    fontSize: 12,
  },
  chartCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  barTrack: {
    width: "100%",
    height: 56,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
  },
});
