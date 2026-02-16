import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore, calculateAge } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface Props {
  chartType: string;
  dataJson: string;
}

export function ChartAISummary({ chartType, dataJson }: Props) {
  const colors = useColors();
  const { state } = useStore();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const summaryMutation = trpc.ai.chartSummary.useMutation();

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const babyProfile = state.profile
        ? {
            name: state.profile.name,
            ageLabel: state.profile.birthDate
              ? calculateAge(state.profile.birthDate).label
              : undefined,
          }
        : undefined;

      const result = await summaryMutation.mutateAsync({
        chartType,
        dataJson,
        babyProfile,
      });

      setInsight(result.insight || "No insight available.");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [chartType, dataJson, state.profile, loading]);

  if (!state.settings.isPremium) {
    return null;
  }

  if (insight) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
        <View style={styles.headerRow}>
          <IconSymbol name="sparkles" size={14} color={colors.primary} />
          <Text style={[styles.headerText, { color: colors.primary }]}>AI Insight</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.foreground }]}>
          {insight}
        </Text>
        <Pressable
          onPress={() => {
            setInsight(null);
            handleGenerate();
          }}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.error + "08", borderColor: colors.error + "20" }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Could not generate insight. Tap to retry.
        </Text>
        <Pressable
          onPress={handleGenerate}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.refreshText, { color: colors.error }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handleGenerate}
      disabled={loading}
      style={({ pressed }) => [
        styles.generateBtn,
        { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" },
        pressed && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <IconSymbol name="sparkles" size={14} color={colors.primary} />
      )}
      <Text style={[styles.generateText, { color: colors.primary }]}>
        {loading ? "Generating insight..." : "Generate AI Insight"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "right",
  },
  errorText: {
    fontSize: 13,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  generateText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
