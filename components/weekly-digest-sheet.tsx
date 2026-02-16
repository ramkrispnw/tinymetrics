import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore, calculateAge, type BabyEvent, type FeedData, type SleepData, type DiaperData } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface Props {
  onClose: () => void;
}

export function WeeklyDigestSheet({ onClose }: Props) {
  const colors = useColors();
  const { state } = useStore();
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digestMutation = trpc.ai.weeklyDigest.useMutation();

  // Get events from the past 7 days
  const weekEvents = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoMs = weekAgo.getTime();
    return state.events.filter(
      (e) => new Date(e.timestamp).getTime() >= weekAgoMs
    );
  }, [state.events]);

  // Compute quick stats
  const stats = useMemo(() => {
    const feeds = weekEvents.filter((e) => e.type === "feed");
    const sleeps = weekEvents.filter((e) => e.type === "sleep");
    const diapers = weekEvents.filter((e) => e.type === "diaper");

    const totalFeedMl = feeds.reduce(
      (sum, e) => sum + ((e.data as FeedData).amountMl || 0),
      0
    );
    const totalSleepMin = sleeps.reduce(
      (sum, e) => sum + ((e.data as SleepData).durationMin || 0),
      0
    );
    const peeCount = diapers.filter(
      (e) => (e.data as DiaperData).type === "pee" || (e.data as DiaperData).type === "both"
    ).length;
    const pooCount = diapers.filter(
      (e) => (e.data as DiaperData).type === "poo" || (e.data as DiaperData).type === "both"
    ).length;

    return {
      totalFeeds: feeds.length,
      totalFeedMl,
      avgFeedMl: feeds.length > 0 ? Math.round(totalFeedMl / feeds.length) : 0,
      totalSleepHrs: Math.round((totalSleepMin / 60) * 10) / 10,
      totalDiapers: diapers.length,
      peeCount,
      pooCount,
    };
  }, [weekEvents]);

  const handleGenerate = async () => {
    if (weekEvents.length === 0) {
      setError("No events recorded in the past 7 days. Log some activities first.");
      return;
    }
    setLoading(true);
    setError(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Prepare a compact JSON of events
      const compactEvents = weekEvents.map((e) => ({
        type: e.type,
        time: e.timestamp,
        data: e.data,
      }));

      const babyProfile = state.profile
        ? {
            name: state.profile.name,
            ageLabel: state.profile.birthDate
              ? calculateAge(state.profile.birthDate).label
              : undefined,
            weight: state.profile.weight ?? undefined,
            weightUnit: state.profile.weightUnit || "kg",
            height: state.profile.height ?? undefined,
            heightUnit: state.profile.heightUnit || "cm",
          }
        : undefined;

      const result = await digestMutation.mutateAsync({
        eventsJson: JSON.stringify(compactEvents),
        babyProfile,
      });

      setDigest(result.summary);
    } catch (err: any) {
      setError(err?.message || "Failed to generate digest. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Weekly Digest</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        {/* Week Stats Summary */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Past 7 Days at a Glance</Text>
        <View style={[styles.statsGrid]}>
          <StatCard
            label="Feeds"
            value={`${stats.totalFeeds}`}
            sub={`${stats.totalFeedMl} ml total`}
            icon="🍼"
            colors={colors}
          />
          <StatCard
            label="Sleep"
            value={`${stats.totalSleepHrs}h`}
            sub={`total recorded`}
            icon="😴"
            colors={colors}
          />
          <StatCard
            label="Diapers"
            value={`${stats.totalDiapers}`}
            sub={`${stats.peeCount} wet · ${stats.pooCount} poo`}
            icon="🧷"
            colors={colors}
          />
          <StatCard
            label="Events"
            value={`${weekEvents.length}`}
            sub="total this week"
            icon="📊"
            colors={colors}
          />
        </View>

        {/* Generate Button */}
        {!digest && (
          <Pressable
            onPress={handleGenerate}
            disabled={loading}
            style={({ pressed }) => [
              styles.generateBtn,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <IconSymbol name="sparkles" size={20} color="#fff" />
            )}
            <Text style={styles.generateBtnText}>
              {loading ? "Generating Summary..." : "Generate AI Weekly Summary"}
            </Text>
          </Pressable>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
            <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
          </View>
        )}

        {/* Digest Content */}
        {digest && (
          <View style={[styles.digestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.digestHeader}>
              <IconSymbol name="sparkles" size={18} color={colors.primary} />
              <Text style={[styles.digestTitle, { color: colors.foreground }]}>
                AI Weekly Summary
              </Text>
            </View>
            <Text style={[styles.digestText, { color: colors.foreground }]}>
              {digest}
            </Text>
            <Pressable
              onPress={() => {
                setDigest(null);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.regenerateBtn,
                { backgroundColor: colors.primary + "15", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                Regenerate
              </Text>
            </Pressable>
          </View>
        )}

        {/* Info note */}
        <View style={styles.infoNote}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
            The weekly digest analyzes your logged events from the past 7 days and generates
            a personalized summary with insights and recommendations.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  colors,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  colors: any;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.statSub, { color: colors.muted }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  title: { fontSize: 17, fontWeight: "700" },
  doneText: { fontSize: 16, fontWeight: "700" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    alignItems: "center",
    gap: 2,
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 13, fontWeight: "600" },
  statSub: { fontSize: 11, textAlign: "center" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  generateBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  errorCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  digestCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 0.5,
    marginTop: 20,
  },
  digestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  digestTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  digestText: {
    fontSize: 14,
    lineHeight: 22,
  },
  regenerateBtn: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  infoNote: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
