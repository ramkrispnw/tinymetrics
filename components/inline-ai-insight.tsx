import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { GlassSurface } from "@/components/ui/glass-surface";

/**
 * nudge      — proactive prediction or suggestion (purple/primary)
 * alert      — something outside the usual pattern (amber/warning)
 * celebration— milestone or positive milestone (green/success)
 * trend      — inline chart annotation (subtle, muted)
 */
export type InsightVariant = "nudge" | "alert" | "celebration" | "trend";

export interface InlineAIInsightProps {
  variant: InsightVariant;
  text: string;
  /** Optional CTA label — renders a tappable link at the end */
  actionLabel?: string;
  onAction?: () => void;
  /** If true, renders a dismiss × button */
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function InlineAIInsight({
  variant,
  text,
  actionLabel,
  onAction,
  dismissible,
  onDismiss,
}: InlineAIInsightProps) {
  const colors = useColors();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const accent = {
    nudge: colors.primary,
    alert: colors.warning,
    celebration: colors.success,
    trend: colors.muted,
  }[variant];

  const icon = {
    nudge: "sparkles" as const,
    alert: "exclamationmark.triangle.fill" as const,
    celebration: "star.fill" as const,
    trend: "chart.bar.fill" as const,
  }[variant];

  const label = {
    nudge: "AI Insight",
    alert: "Heads Up",
    celebration: "Milestone",
    trend: "Trend",
  }[variant];

  const handleDismiss = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <GlassSurface
      borderRadius={12}
      tintColor={accent}
      style={styles.container}
    >
      {/* Header row: icon + label + optional dismiss */}
      <View style={styles.headerRow}>
        <IconSymbol name={icon} size={13} color={accent} />
        <Text style={[styles.label, { color: accent }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        {dismissible && (
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.5 }]}
          >
            <IconSymbol name="xmark" size={12} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Body */}
      <Text style={[styles.body, { color: colors.foreground }]}>{text}</Text>

      {/* Optional action link */}
      {actionLabel && onAction && (
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction();
          }}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.actionText, { color: accent }]}>{actionLabel}</Text>
          <IconSymbol name="chevron.right" size={11} color={accent} />
        </Pressable>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
