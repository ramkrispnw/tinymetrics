import { useState, useRef, useCallback } from "react";
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
  calculateAge,
} from "@/lib/store";
import { buildAIContext } from "@/lib/ai-context-builder";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
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
   * Build comprehensive context using the baby coacher skill.
   * Includes: profile, today's projections, events (last 14 days),
   * growth history, milestones, and age-specific targets.
   */
  const buildContext = () => {
    return buildAIContext(
      state.profile,
      state.events,
      state.growthHistory,
      state.milestones,
      state.activeSleep
    );
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
        question: "Generate a comprehensive daily summary of the baby's feeding, sleeping, diaper changes, and any health observations. Include trends compared to previous days. When using a table for the daily breakdown, use EXACTLY ONE row per date — never split a single date across multiple rows. Every table that includes diapers MUST include both wet diaper count AND poo diaper count as separate columns. Highlight any patterns or concerns. Tailor your advice to the baby's age, weight, and height.",
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (id: string, content: string) => {
    await Clipboard.setStringAsync(content);
    setCopiedId(id);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  }, []);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isCopied = copiedId === item.id;
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
          <>
            <MarkdownText
              content={item.content}
              baseColor={colors.foreground}
            />
            <Pressable
              onPress={() => handleCopy(item.id, item.content)}
              style={({ pressed }) => [
                styles.copyBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <IconSymbol
                name={isCopied ? "checkmark" : "doc.on.doc"}
                size={13}
                color={isCopied ? colors.success : colors.muted}
              />
              <Text style={[styles.copyLabel, { color: isCopied ? colors.success : colors.muted }]}>
                {isCopied ? "Copied" : "Copy"}
              </Text>
            </Pressable>
          </>
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
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  copyLabel: {
    fontSize: 11,
    fontWeight: "500",
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
