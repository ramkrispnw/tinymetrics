import { useState } from "react";
import {
  Text,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { pickImage } from "@/lib/image-utils";
import * as Haptics from "expo-haptics";

type ImportStep = "pick" | "uploading" | "parsing" | "preview" | "importing" | "done" | "error";

interface ParsedEvent {
  type: "feed" | "sleep" | "diaper" | "observation";
  timestamp: string;
  data: any;
}

interface Props {
  onClose: () => void;
}

export function ImportLogsSheet({ onClose }: Props) {
  const colors = useColors();
  const { importEvents } = useStore();
  const parsePdf = trpc.ai.parsePdfLogs.useMutation();
  const parseImage = trpc.ai.parseImageLogs.useMutation();

  const [step, setStep] = useState<ImportStep>("pick");
  const [fileName, setFileName] = useState("");
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePickImage = async (source: "camera" | "gallery") => {
    try {
      const result = await pickImage(source);
      if (!result) return;

      setFileName(source === "camera" ? "Camera Photo" : "Photo from Library");
      setStep("uploading");

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setStep("parsing");

      const result2 = await parseImage.mutateAsync({
        imageBase64: result.base64 || "",
        mimeType: "image/jpeg",
      });

      if (result2.events && result2.events.length > 0) {
        setParsedEvents(result2.events);
        setStep("preview");
      } else {
        setErrorMsg(
          (result2 as any).error || "No events could be extracted from this image. Make sure it contains baby care logs."
        );
        setStep("error");
      }
    } catch (err: any) {
      console.error("[ImportLogs] Image Error:", err);
      setErrorMsg(err?.message || "Failed to process the image. Please try again.");
      setStep("error");
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setFileName(asset.name);
      setStep("uploading");

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Read file as base64
      let base64: string;
      if (Platform.OS === "web") {
        // On web, use the File API
        const file = asset.file;
        if (file) {
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else {
          // Fallback: fetch the URI
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      setStep("parsing");

      // Send to AI for parsing
      const result2 = await parsePdf.mutateAsync({
        fileBase64: base64,
        mimeType: asset.mimeType || "application/pdf",
        fileName: asset.name,
      });

      if (result2.events && result2.events.length > 0) {
        setParsedEvents(result2.events);
        setStep("preview");
      } else {
        setErrorMsg(
          (result2 as any).error || "No events could be extracted from this file. Make sure it contains baby care logs."
        );
        setStep("error");
      }
    } catch (err: any) {
      console.error("[ImportLogs] Error:", err);
      setErrorMsg(err?.message || "Failed to process the file. Please try again.");
      setStep("error");
    }
  };

  /** Normalize a single parsed event so Trends charts can read it reliably. */
  const normalizeEvent = (e: ParsedEvent) => {
    const validTypes = ["feed", "sleep", "diaper", "observation"] as const;
    const type = validTypes.includes(e.type as any) ? (e.type as typeof validTypes[number]) : "observation";

    // Ensure timestamp is a valid ISO string
    let timestamp = e.timestamp || new Date().toISOString();
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) timestamp = new Date().toISOString();
      else timestamp = d.toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    const raw = e.data || {};
    let data: any;

    switch (type) {
      case "feed": {
        const validMethods = ["bottle", "breast_left", "breast_right", "solid"];
        data = {
          method: validMethods.includes(raw.method) ? raw.method : "bottle",
          amountMl: typeof raw.amountMl === "number" ? raw.amountMl : Number(raw.amountMl) || 0,
          durationMin: typeof raw.durationMin === "number" ? raw.durationMin : Number(raw.durationMin) || undefined,
          notes: raw.notes || undefined,
        };
        break;
      }
      case "sleep": {
        data = {
          startTime: raw.startTime || timestamp,
          endTime: raw.endTime || undefined,
          durationMin: typeof raw.durationMin === "number" ? raw.durationMin : Number(raw.durationMin) || 0,
          notes: raw.notes || undefined,
        };
        break;
      }
      case "diaper": {
        const validDiaperTypes = ["pee", "poo", "both"];
        data = {
          type: validDiaperTypes.includes(raw.type) ? raw.type : "pee",
          pooColor: raw.pooColor || undefined,
          pooConsistency: raw.pooConsistency || undefined,
          notes: raw.notes || undefined,
        };
        break;
      }
      case "observation":
      default: {
        const validCategories = ["rash", "fast_breathing", "fever", "vomiting", "cough", "other"];
        const validSeverities = ["mild", "moderate", "severe"];
        data = {
          category: validCategories.includes(raw.category) ? raw.category : "other",
          severity: validSeverities.includes(raw.severity) ? raw.severity : "mild",
          description: raw.description || raw.notes || undefined,
          notes: raw.notes || undefined,
        };
        break;
      }
    }

    return { type, timestamp, data };
  };

  const handleImport = async () => {
    setStep("importing");
    try {
      const eventsToImport = parsedEvents.map(normalizeEvent);

      const count = await importEvents(eventsToImport);
      setImportedCount(count);
      setStep("done");

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to import events.");
      setStep("error");
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "feed": return "🍼";
      case "sleep": return "🌙";
      case "diaper": return "💩";
      case "observation": return "👁";
      default: return "📝";
    }
  };

  const getEventSummary = (event: ParsedEvent) => {
    const d = event.data || {};
    switch (event.type) {
      case "feed":
        return d.amountMl ? `${d.method || "bottle"} - ${d.amountMl}ml` : d.method || "Feed";
      case "sleep":
        return d.durationMin ? `${d.durationMin} min` : "Sleep logged";
      case "diaper":
        return d.type || "Diaper change";
      case "observation":
        return d.category || d.description || "Observation";
      default:
        return "Event";
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Import Logs</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Step: Pick File */}
        {step === "pick" && (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <Text style={{ fontSize: 40 }}>📄</Text>
            </View>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Import Prior Logs
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              Upload a PDF or text file with your baby care notes (from Apple Notes, Google Docs, etc.). 
              AI will automatically extract feed, sleep, diaper, and observation events.
            </Text>

            <Pressable
              onPress={handlePickFile}
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="doc.on.doc.fill" size={20} color="#fff" />
              <Text style={styles.pickBtnText}>Choose File (PDF / Text)</Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 12 }}>
              <Pressable
                onPress={() => handlePickImage("camera")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: colors.success, flex: 1 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="camera.fill" size={20} color="#fff" />
                <Text style={styles.pickBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickImage("gallery")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: "#6366F1", flex: 1 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="photo.fill" size={20} color="#fff" />
                <Text style={styles.pickBtnText}>From Photos</Text>
              </Pressable>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>Supported Formats</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
                {"\u2022"} PDF files (from Apple Notes, Google Docs, etc.){"\n"}
                {"\u2022"} Text files (.txt){"\n"}
                {"\u2022"} Photos of handwritten notes or screenshots{"\n"}
                {"\u2022"} Any image or document with baby care logs
              </Text>
              <View style={[styles.tipRow, { backgroundColor: colors.primary + "10", marginTop: 12 }]}>
                <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 18 }}>
                  💡 Tip: The more structured your notes are (dates, times, amounts), the better the AI can extract events.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Step: Uploading / Parsing */}
        {(step === "uploading" || step === "parsing") && (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              {step === "uploading" ? "Uploading File..." : "AI is Reading Your Notes..."}
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              {step === "uploading"
                ? `Uploading ${fileName}...`
                : "Extracting baby care events from your document. This may take a moment."}
            </Text>
          </View>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <View>
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: colors.success + "20" }]}>
                <Text style={{ fontSize: 40 }}>✅</Text>
              </View>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Found {parsedEvents.length} Event{parsedEvents.length !== 1 ? "s" : ""}
              </Text>
              <Text style={[styles.description, { color: colors.muted }]}>
                Extracted from your daily logs. Each day's intake is logged as one feed, and individual diaper events are created for each pee/poo count. Tap Import to add them.
              </Text>
            </View>

            {/* Event list */}
            <View style={{ marginTop: 16 }}>
              {parsedEvents.slice(0, 50).map((event, idx) => (
                <View
                  key={idx}
                  style={[styles.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 20 }}>{getEventIcon(event.type)}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {getEventSummary(event)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {formatTimestamp(event.timestamp)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          event.type === "feed"
                            ? colors.primary + "20"
                            : event.type === "sleep"
                            ? "#6366F1" + "20"
                            : event.type === "diaper"
                            ? colors.warning + "20"
                            : colors.error + "20",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color:
                          event.type === "feed"
                            ? colors.primary
                            : event.type === "sleep"
                            ? "#6366F1"
                            : event.type === "diaper"
                            ? colors.warning
                            : colors.error,
                      }}
                    >
                      {event.type}
                    </Text>
                  </View>
                </View>
              ))}
              {parsedEvents.length > 50 && (
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                  ...and {parsedEvents.length - 50} more events
                </Text>
              )}
            </View>

            {/* Import button */}
            <Pressable
              onPress={handleImport}
              style={({ pressed }) => [
                styles.importBtn,
                { backgroundColor: colors.success },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.importBtnText}>
                Import {parsedEvents.length} Event{parsedEvents.length !== 1 ? "s" : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setStep("pick");
                setParsedEvents([]);
              }}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 12, fontSize: 14 }}>
                Cancel & Pick Different File
              </Text>
            </Pressable>
          </View>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + "20" }]}>
              <ActivityIndicator size="large" color={colors.success} />
            </View>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Importing Events...
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              Adding {parsedEvents.length} events to your logs.
            </Text>
          </View>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success + "20" }]}>
              <Text style={{ fontSize: 40 }}>🎉</Text>
            </View>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Import Complete!
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              Successfully imported {importedCount} event{importedCount !== 1 ? "s" : ""} from {fileName}. 
              Check your Activity tab to see them.
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.pickBtnText}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: colors.error + "20" }]}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
            </View>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Import Failed
            </Text>
            <Text style={[styles.description, { color: colors.muted }]}>
              {errorMsg}
            </Text>
            <Pressable
              onPress={() => {
                setStep("pick");
                setErrorMsg("");
                setParsedEvents([]);
              }}
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.pickBtnText}>Try Again</Text>
            </Pressable>
          </View>
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
  cancelText: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "700" },
  content: {
    alignItems: "center",
    paddingTop: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    width: "100%",
  },
  pickBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  infoCard: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  tipRow: {
    padding: 12,
    borderRadius: 10,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  importBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  importBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
