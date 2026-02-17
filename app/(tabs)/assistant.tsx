import { useState, useRef, useMemo } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import {
  isToday,
  formatDuration,
  mlToOz,
  getDayKey,
  calculateAge,
  getProfileSummary,
  type BabyEvent,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
  type GrowthData,
  type GrowthEntry,
  type Milestone,
  type PumpData,
} from "@/lib/store";
import * as Haptics from "expo-haptics";
import { pickImage } from "@/lib/image-utils";
import { MarkdownText } from "@/components/markdown-text";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function AssistantScreen() {
  const colors = useColors();
  const { state } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isPremium = state.settings.isPremium;

  const getBabyProfilePayload = () => {
    if (!state.profile) return undefined;
    const ageInfo = state.profile.birthDate ? calculateAge(state.profile.birthDate) : null;
    return {
      name: state.profile.name || undefined,
      ageLabel: ageInfo?.label || undefined,
      weight: state.profile.weight ?? undefined,
      weightUnit: state.profile.weightUnit || undefined,
      height: state.profile.height ?? undefined,
      heightUnit: state.profile.heightUnit || undefined,
    };
  };

  /**
   * Build comprehensive context with ALL baby data for the AI.
   * Includes: profile, events (last 14 days with daily breakdown),
   * growth history, milestones, and current patterns.
   */
  const buildContext = () => {
    const parts: string[] = [];

    // ── Profile ──
    parts.push("## BABY PROFILE");
    parts.push(getProfileSummary(state.profile));
    if (state.profile?.sex) parts.push(`Sex: ${state.profile.sex}`);

    // ── Date range: last 14 days ──
    const dayKeys: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayKeys.push(getDayKey(d.toISOString()));
    }
    const todayKey = dayKeys[0];

    // ── Events by day ──
    const recentEvents = state.events.filter((e) =>
      dayKeys.includes(getDayKey(e.timestamp))
    );

    // Group by day
    const byDay = new Map<string, BabyEvent[]>();
    for (const e of recentEvents) {
      const dk = getDayKey(e.timestamp);
      if (!byDay.has(dk)) byDay.set(dk, []);
      byDay.get(dk)!.push(e);
    }

    // ── Today's detailed breakdown ──
    const todayEvents = byDay.get(todayKey) || [];
    parts.push("\n## TODAY'S EVENTS (" + todayKey + ")");
    if (todayEvents.length === 0) {
      parts.push("No events logged today yet.");
    } else {
      const feeds = todayEvents.filter((e) => e.type === "feed");
      const sleeps = todayEvents.filter((e) => e.type === "sleep");
      const diapers = todayEvents.filter((e) => e.type === "diaper");
      const observations = todayEvents.filter((e) => e.type === "observation");

      if (feeds.length > 0) {
        const totalMl = feeds.reduce((s, e) => s + ((e.data as FeedData).amountMl || 0), 0);
        const totalMin = feeds.reduce((s, e) => s + ((e.data as FeedData).durationMin || 0), 0);
        parts.push(`Feeding: ${feeds.length} sessions, ${totalMl}ml total, ${totalMin}min total nursing`);
        feeds.forEach((e) => {
          const d = e.data as FeedData;
          const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const method = d.method === "bottle" ? "Bottle" : d.method === "solid" ? "Solid" : "Breast";
          parts.push(`  - ${time}: ${method}${d.amountMl ? ` ${d.amountMl}ml` : ""}${d.durationMin ? ` ${d.durationMin}min` : ""}${d.notes ? ` (${d.notes})` : ""}`);
        });
      }

      if (sleeps.length > 0) {
        const totalMin = sleeps.reduce((s, e) => s + ((e.data as SleepData).durationMin || 0), 0);
        parts.push(`Sleep: ${sleeps.length} sessions, ${formatDuration(totalMin)} total`);
        sleeps.forEach((e) => {
          const d = e.data as SleepData;
          const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          parts.push(`  - ${time}: ${d.durationMin ? formatDuration(d.durationMin) : "in progress"}${d.notes ? ` (${d.notes})` : ""}`);
        });
      }

      if (diapers.length > 0) {
        const pee = diapers.filter((e) => (e.data as DiaperData).type === "pee").length;
        const poo = diapers.filter((e) => (e.data as DiaperData).type === "poo").length;
        const both = diapers.filter((e) => (e.data as DiaperData).type === "both").length;
        parts.push(`Diapers: ${diapers.length} changes (${pee} pee, ${poo} poo, ${both} both)`);
        diapers.forEach((e) => {
          const d = e.data as DiaperData;
          const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          parts.push(`  - ${time}: ${d.type}${d.pooColor ? ` color:${d.pooColor}` : ""}${d.pooConsistency ? ` consistency:${d.pooConsistency}` : ""}${d.notes ? ` (${d.notes})` : ""}`);
        });
      }

      if (observations.length > 0) {
        parts.push(`Observations: ${observations.length}`);
        observations.forEach((e) => {
          const d = e.data as ObservationData;
          const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          parts.push(`  - ${time}: ${d.category} (${d.severity})${d.description ? ` - ${d.description}` : ""}${d.notes ? ` (${d.notes})` : ""}`);
        });
      }

      const pumps = todayEvents.filter((e) => e.type === "pump");
      if (pumps.length > 0) {
        const totalMl = pumps.reduce((s, e) => s + ((e.data as PumpData).amountMl || 0), 0);
        const totalMin = pumps.reduce((s, e) => s + ((e.data as PumpData).durationMin || 0), 0);
        parts.push(`Pumping: ${pumps.length} sessions, ${totalMl}ml total, ${totalMin}min total`);
        pumps.forEach((e) => {
          const d = e.data as PumpData;
          const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const sideLabel = d.side === "both" ? "Both" : d.side === "left" ? "Left" : "Right";
          parts.push(`  - ${time}: ${sideLabel}${d.amountMl ? ` ${d.amountMl}ml` : ""}${d.durationMin ? ` ${d.durationMin}min` : ""}${d.notes ? ` (${d.notes})` : ""}`);
        });
      }
    }

    // ── Weekly summary (last 7 days) ──
    parts.push("\n## LAST 7 DAYS SUMMARY");
    const last7Keys = dayKeys.slice(0, 7);
    for (const dk of last7Keys) {
      const dayEvents = byDay.get(dk) || [];
      if (dayEvents.length === 0) {
        parts.push(`${dk}: No events`);
        continue;
      }
      const feeds = dayEvents.filter((e) => e.type === "feed");
      const sleeps = dayEvents.filter((e) => e.type === "sleep");
      const diapers = dayEvents.filter((e) => e.type === "diaper");
      const pumps = dayEvents.filter((e) => e.type === "pump");
      const feedMl = feeds.reduce((s, e) => s + ((e.data as FeedData).amountMl || 0), 0);
      const sleepMin = sleeps.reduce((s, e) => s + ((e.data as SleepData).durationMin || 0), 0);
      const pumpMl = pumps.reduce((s, e) => s + ((e.data as PumpData).amountMl || 0), 0);
      parts.push(`${dk}: ${feeds.length} feeds (${feedMl}ml), ${sleeps.length} sleeps (${formatDuration(sleepMin)}), ${diapers.length} diapers${pumps.length > 0 ? `, ${pumps.length} pumps (${pumpMl}ml)` : ""}`);
    }

    // ── Growth history ──
    if (state.growthHistory.length > 0) {
      parts.push("\n## GROWTH HISTORY");
      const recent = state.growthHistory.slice(0, 10);
      recent.forEach((g: GrowthEntry) => {
        const items: string[] = [];
        if (g.weight != null) items.push(`${g.weight} ${g.weightUnit || "kg"}`);
        if (g.height != null) items.push(`${g.height} ${g.heightUnit || "cm"}`);
        parts.push(`${g.date}: ${items.join(", ")}`);
      });
    }

    // ── Milestones ──
    if (state.milestones.length > 0) {
      parts.push("\n## MILESTONES ACHIEVED");
      state.milestones.slice(0, 15).forEach((m: Milestone) => {
        parts.push(`${m.date}: ${m.title} (${m.category})${m.notes ? ` - ${m.notes}` : ""}`);
      });
    }

    // ── Active sleep ──
    if (state.activeSleep) {
      const start = new Date(state.activeSleep.startTime);
      const elapsedMin = Math.round((Date.now() - start.getTime()) / 60000);
      parts.push(`\n## ACTIVE SLEEP: Baby has been sleeping for ${formatDuration(elapsedMin)} (started at ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`);
    }

    // Truncate to stay within limits
    const full = parts.join("\n");
    return full.length > 14000 ? full.slice(0, 14000) + "\n...(truncated)" : full;
  };

  const askAI = trpc.ai.ask.useMutation();
  const analyzePhoto = trpc.ai.analyzePhoto.useMutation();

  const handlePhotoUpload = async () => {
    const img = await pickImage("gallery");
    if (!img || loading) return;
    setLoading(true);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: "[Photo uploaded] " + (input.trim() || "Please analyze this photo."),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const result = await analyzePhoto.mutateAsync({
        imageBase64: img.base64,
        mimeType: img.mimeType,
        question: input.trim() || undefined,
        babyProfile: getBabyProfilePayload(),
      });
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't analyze the photo. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const context = buildContext();
      const result = await askAI.mutateAsync({
        question: userMsg.content,
        context,
        babyProfile: getBabyProfilePayload(),
      });
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
    setLoading(false);
  };

  const handleGenerateSummary = async () => {
    if (loading) return;
    setLoading(true);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: "Generate a daily summary of my baby's activities and health.",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const context = buildContext();
      const result = await askAI.mutateAsync({
        question: "Generate a comprehensive daily summary of the baby's feeding, sleeping, diaper changes, and any health observations. Include trends compared to previous days. Use a table for the daily breakdown. Highlight any patterns or concerns. Tailor your advice to the baby's age, weight, and height.",
        context,
        babyProfile: getBabyProfilePayload(),
      });
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't generate the summary. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
    setLoading(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          {
            alignSelf: isUser ? "flex-end" : "flex-start",
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderColor: isUser ? colors.primary : colors.border,
            maxWidth: isUser ? "80%" : "92%",
          },
        ]}
      >
        {isUser ? (
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {item.content}
          </Text>
        ) : (
          <MarkdownText
            content={item.content}
            baseColor={colors.foreground}
          />
        )}
      </View>
    );
  };

  // Premium Gate
  if (!isPremium) {
    return (
      <ScreenContainer className="px-4 pt-2">
        <View style={styles.premiumGate}>
          <View style={[styles.premiumIcon, { backgroundColor: colors.warning + "20" }]}>
            <IconSymbol name="crown.fill" size={40} color={colors.warning} />
          </View>
          <Text style={[styles.premiumTitle, { color: colors.foreground }]}>
            AI Assistant
          </Text>
          <Text style={[styles.premiumSubtitle, { color: colors.muted }]}>
            Unlock AI-powered summaries, health insights, and answers to your parenting questions.
          </Text>
          <View style={styles.featureList}>
            {[
              "Daily health summaries",
              "Ask questions about patterns",
              "Photo analysis for bottles & diapers",
              "Personalized recommendations",
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                <Text style={{ color: colors.foreground, fontSize: 14 }}>{feature}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 16 }}>
            Enable Premium in Settings to unlock
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4 pt-2">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>
            AI Assistant
          </Text>
          <Pressable
            onPress={handleGenerateSummary}
            disabled={loading}
            style={({ pressed }) => [
              styles.summaryBtn,
              { backgroundColor: colors.primary + "15", borderColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="sparkles" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
              Summary
            </Text>
          </Pressable>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="sparkles" size={40} color={colors.primary + "40"} />
            <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 12 }}>
              Ask me anything about your baby's health, feeding patterns, or sleep schedule.
            </Text>
            <View style={styles.suggestionsContainer}>
              {[
                "How much did my baby eat today?",
                "Is the sleep pattern normal?",
                "Summarize this week's activities",
                "Any concerns based on recent data?",
              ].map((suggestion, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setInput(suggestion);
                  }}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Loading */}
        {loading && (
          <View style={[styles.loadingRow, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={handlePhotoUpload}
            disabled={loading}
            style={({ pressed }) => [
              styles.photoBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <IconSymbol name="camera.fill" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your baby..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            style={[styles.textInput, { color: colors.foreground }]}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || loading}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: input.trim() ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  premiumGate: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  premiumIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  premiumSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  featureList: {
    gap: 12,
    width: "100%",
    maxWidth: 300,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  suggestionsContainer: {
    marginTop: 24,
    gap: 8,
    width: "100%",
  },
  suggestion: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
