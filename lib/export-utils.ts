import { Platform, Share, Alert } from "react-native";
import type {
  AppState,
  BabyEvent,
  FeedData,
  SleepData,
  DiaperData,
  ObservationData,
  GrowthEntry,
} from "./store";
import { formatDuration, mlToOz, calculateAge } from "./store";

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function generateEventsCSV(events: BabyEvent[], units: "ml" | "oz"): string {
  const header = "Date,Time,Type,Details,Amount,Duration,Notes";
  const rows = events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((e) => {
      const d = new Date(e.timestamp);
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      let details = "";
      let amount = "";
      let duration = "";
      let notes = "";

      switch (e.type) {
        case "feed": {
          const fd = e.data as FeedData;
          details = `Feed (${fd.method})`;
          if (fd.amountMl) {
            amount = units === "oz" ? `${mlToOz(fd.amountMl)} oz` : `${fd.amountMl} ml`;
          }
          if (fd.durationMin) duration = formatDuration(fd.durationMin);
          if (fd.notes) notes = fd.notes;
          break;
        }
        case "sleep": {
          const sd = e.data as SleepData;
          details = "Sleep";
          if (sd.durationMin) duration = formatDuration(sd.durationMin);
          break;
        }
        case "diaper": {
          const dd = e.data as DiaperData;
          details = `Diaper (${dd.type === "both" ? "Pee & Poo" : dd.type === "pee" ? "Pee" : "Poo"})`;
          if ((dd as any).color) notes = `Color: ${(dd as any).color}`;
          break;
        }
        case "observation": {
          const od = e.data as ObservationData;
          details = `Observation (${od.category.replace("_", " ")})`;
          notes = `Severity: ${od.severity}${od.notes ? " - " + od.notes : ""}`;
          break;
        }
      }

      return [date, time, e.type, details, amount, duration, notes].map(escapeCSV).join(",");
    });

  return [header, ...rows].join("\n");
}

export function generateGrowthCSV(entries: GrowthEntry[]): string {
  const header = "Date,Weight,Weight Unit,Height,Height Unit";
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      return [
        e.date,
        e.weight != null ? e.weight.toString() : "",
        e.weightUnit || "",
        e.height != null ? e.height.toString() : "",
        e.heightUnit || "",
      ]
        .map(escapeCSV)
        .join(",");
    });

  return [header, ...rows].join("\n");
}

export function generateFullReport(state: AppState): string {
  const lines: string[] = [];
  const profile = state.profile;

  lines.push("=== TinyMetrics Baby Report ===");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (profile) {
    lines.push("--- Baby Profile ---");
    lines.push(`Name: ${profile.name}`);
    lines.push(`Date of Birth: ${profile.birthDate}`);
    const age = calculateAge(profile.birthDate);
    lines.push(`Age: ${age.label}`);
    if (profile.weight != null) lines.push(`Weight: ${profile.weight} ${profile.weightUnit || "kg"}`);
    if (profile.height != null) lines.push(`Height: ${profile.height} ${profile.heightUnit || "cm"}`);
    lines.push("");
  }

  lines.push("--- Events Summary ---");
  lines.push(`Total events: ${state.events.length}`);
  const feeds = state.events.filter((e) => e.type === "feed");
  const sleeps = state.events.filter((e) => e.type === "sleep");
  const diapers = state.events.filter((e) => e.type === "diaper");
  const observations = state.events.filter((e) => e.type === "observation");
  lines.push(`Feeds: ${feeds.length}`);
  lines.push(`Sleep sessions: ${sleeps.length}`);
  lines.push(`Diaper changes: ${diapers.length}`);
  lines.push(`Observations: ${observations.length}`);
  lines.push("");

  if (state.growthHistory.length > 0) {
    lines.push("--- Growth History ---");
    [...state.growthHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => {
        const parts = [e.date];
        if (e.weight != null) parts.push(`${e.weight} ${e.weightUnit || "kg"}`);
        if (e.height != null) parts.push(`${e.height} ${e.heightUnit || "cm"}`);
        lines.push(parts.join(" | "));
      });
    lines.push("");
  }

  lines.push("--- Event Details (CSV) ---");
  lines.push(generateEventsCSV(state.events, state.settings.units));

  return lines.join("\n");
}

export async function shareData(title: string, content: string) {
  try {
    if (Platform.OS === "web") {
      // Web: try navigator.share or fallback to clipboard
      if (typeof navigator !== "undefined" && navigator.share) {
        const blob = new Blob([content], { type: "text/csv" });
        const file = new File([blob], `${title}.csv`, { type: "text/csv" });
        await navigator.share({ title, files: [file] });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        Alert.alert("Copied", "Data copied to clipboard");
      }
    } else {
      await Share.share({
        title,
        message: content,
      });
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      console.error("Share error:", e);
    }
  }
}
