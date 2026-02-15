import { useState, useEffect } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

interface Props {
  onClose: () => void;
}

export function ShareSheet({ onClose }: Props) {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const partnerQuery = trpc.sharing.getPartner.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const pendingQuery = trpc.sharing.getPendingInvite.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const createInvite = trpc.sharing.createInvite.useMutation();
  const acceptInvite = trpc.sharing.acceptInvite.useMutation();
  const revokeSharing = trpc.sharing.revokeSharing.useMutation();

  useEffect(() => {
    if (pendingQuery.data?.code) {
      setInviteCode(pendingQuery.data.code);
    }
  }, [pendingQuery.data]);

  const handleGenerateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createInvite.mutateAsync();
      setInviteCode(result.code);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError("Failed to generate invite code. Please try again.");
    }
    setLoading(false);
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: just show the code
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || joining) return;
    setJoining(true);
    setError(null);
    try {
      const result = await acceptInvite.mutateAsync({ code: joinCode.trim().toUpperCase() });
      if (result.success) {
        setSuccessMsg(`Connected with ${(result as any).ownerName || "your partner"}!`);
        setJoinCode("");
        partnerQuery.refetch();
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setError((result as any).error || "Invalid invite code");
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (e: any) {
      setError("Failed to join. Please check the code and try again.");
    }
    setJoining(false);
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await revokeSharing.mutateAsync();
      setInviteCode(null);
      setSuccessMsg(null);
      partnerQuery.refetch();
      pendingQuery.refetch();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setError("Failed to remove sharing.");
    }
    setLoading(false);
  };

  const partner = partnerQuery.data;

  if (!isAuthenticated) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Share Account</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.gateContainer}>
          <View style={[styles.gateIcon, { backgroundColor: colors.primary + "15" }]}>
            <IconSymbol name="person.2.fill" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.gateTitle, { color: colors.foreground }]}>
            Sign In Required
          </Text>
          <Text style={[styles.gateSubtitle, { color: colors.muted }]}>
            To share your baby's tracking data with a partner, both parents need to sign in with Google first. Go to Settings to sign in.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 50 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Share Account</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        {/* Success message */}
        {successMsg && (
          <View style={[styles.successBanner, { backgroundColor: colors.success + "15", borderColor: colors.success + "40" }]}>
            <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600", flex: 1 }}>
              {successMsg}
            </Text>
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
            <IconSymbol name="info.circle.fill" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 14, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Connected Partner */}
        {partner && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Connected Partner</Text>
            <View style={[styles.partnerCard, { backgroundColor: colors.success + "08", borderColor: colors.success + "30" }]}>
              <View style={[styles.partnerAvatar, { backgroundColor: colors.success + "20" }]}>
                <IconSymbol name="person.fill" size={24} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.partnerName, { color: colors.foreground }]}>
                  {partner.partnerName}
                </Text>
                {partner.partnerEmail && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {partner.partnerEmail}
                  </Text>
                )}
                <Text style={{ color: colors.success, fontSize: 12, marginTop: 2 }}>
                  {partner.role === "owner" ? "You invited them" : "They invited you"}
                </Text>
              </View>
              <Pressable
                onPress={handleRevoke}
                disabled={loading}
                style={({ pressed }) => [
                  styles.revokeBtn,
                  { backgroundColor: colors.error + "10", borderColor: colors.error + "30" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Remove</Text>
                )}
              </Pressable>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
                Both parents can log events and view the same data. Data is stored locally on each device — share your invite code so your partner can track alongside you.
              </Text>
            </View>
          </>
        )}

        {/* Invite Section (only if no partner yet) */}
        {!partner && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Invite Your Partner</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                <IconSymbol name="person.2.fill" size={28} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
                Generate an invite code
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 4 }}>
                Share this code with your partner so they can connect to your baby's tracking data.
              </Text>

              {inviteCode ? (
                <View style={styles.codeSection}>
                  <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.primary + "40" }]}>
                    <Text style={[styles.codeText, { color: colors.primary }]}>
                      {inviteCode}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleCopyCode}
                    style={({ pressed }) => [
                      styles.copyBtn,
                      { backgroundColor: colors.primary },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <IconSymbol name="doc.on.doc.fill" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                      {copied ? "Copied!" : "Copy Code"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleGenerateCode}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.generateBtn,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                      Generate Invite Code
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* Join Section */}
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Join a Partner</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
                Have an invite code?
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 4 }}>
                Enter the code your partner shared with you to connect.
              </Text>

              <View style={styles.joinRow}>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    value={joinCode}
                    onChangeText={(t) => setJoinCode(t.toUpperCase())}
                    placeholder="Enter code"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                    style={[styles.joinTextInput, { color: colors.foreground }]}
                  />
                </View>
                <Pressable
                  onPress={handleJoin}
                  disabled={joining || !joinCode.trim()}
                  style={({ pressed }) => [
                    styles.joinBtn,
                    {
                      backgroundColor: joinCode.trim() ? colors.primary : colors.muted + "40",
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Join</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
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
  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  gateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  gateSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  codeSection: {
    marginTop: 12,
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  codeBox: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  codeText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 6,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  generateBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  joinRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    width: "100%",
  },
  joinInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  joinTextInput: {
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 12,
    letterSpacing: 3,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  joinBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "700",
  },
  revokeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
