import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  type BabyEvent,
  type FeedData,
  type SleepData,
  type DiaperData,
  type ObservationData,
  type PumpData,
  type FormulaPrepData,
  type MedicationData,
  formatTime,
  formatDate,
  formatDuration,
  mlToOz,
} from "@/lib/store";
import { useStore } from "@/lib/store";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface Props {
  visible: boolean;
  event: BabyEvent | null;
  onClose: () => void;
  onEdit?: () => void;
}

export function EventDetailSheet({ visible, event, onClose, onEdit }: Props) {
  const colors = useColors();
  const { state } = useStore();
  const units = state.settings.units;

  if (!event) return null;

  const getTypeColor = () => {
    switch (event.type) {
      case "feed": return colors.feed;
      case "sleep": return colors.sleep;
      case "diaper": return colors.diaper;
      case "observation": return colors.observation;
      case "pump": return colors.pump;
      case "formula_prep": return colors.formula;
      case "medication": return colors.medication;
      default: return colors.primary;
    }
  };

  const getTypeIcon = (): any => {
    switch (event.type) {
      case "feed": return "fork.knife";
      case "sleep": return "moon.fill";
      case "diaper": return "drop.fill";
      case "observation": return "eye.fill";
      case "pump": return "drop.triangle.fill";
      case "formula_prep": return "flask.fill";
      case "medication": return "pills.fill";
      default: return "info.circle.fill";
    }
  };

  const getTypeLabel = () => {
    switch (event.type) {
      case "formula_prep": return "Formula Prep";
      case "medication": return "Medication";
      default: return event.type.charAt(0).toUpperCase() + event.type.slice(1);
    }
  };

  const typeColor = getTypeColor();

  const renderDetailRows = () => {
    const rows: { label: string; value: string }[] = [];

    switch (event.type) {
      case "feed": {
        const d = event.data as FeedData;
        if (d.method) {
          const methodLabels: Record<string, string> = {
            bottle: "Bottle",
            breast_left: "Breast (Left)",
            breast_right: "Breast (Right)",
            solid: "Solid Food",
          };
          rows.push({ label: "Method", value: methodLabels[d.method] || d.method });
        }
        if (d.amountMl != null) {
          const displayAmt = units === "oz"
            ? `${(d.amountMl * 0.033814).toFixed(1)} oz`
            : `${d.amountMl} ml`;
          rows.push({ label: "Amount", value: displayAmt });
        }
        if (d.durationMin != null) {
          rows.push({ label: "Duration", value: formatDuration(d.durationMin) });
        }
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "sleep": {
        const d = event.data as SleepData;
        if (d.durationMin != null) {
          rows.push({ label: "Duration", value: formatDuration(d.durationMin) });
        }
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "diaper": {
        const d = event.data as DiaperData;
        const typeLabels: Record<string, string> = {
          pee: "Pee Only",
          poo: "Poo Only",
          both: "Pee & Poo",
        };
        rows.push({ label: "Type", value: typeLabels[d.type] || d.type });
        if (d.pooColor) rows.push({ label: "Poo Color", value: d.pooColor });
        if (d.pooConsistency) rows.push({ label: "Consistency", value: d.pooConsistency });
        if (d.pooSize) {
          rows.push({ label: "Poo Size", value: d.pooSize.charAt(0).toUpperCase() + d.pooSize.slice(1) });
        }
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "observation": {
        const d = event.data as ObservationData;
        if (d.category) rows.push({ label: "Category", value: d.category });
        if (d.severity) rows.push({ label: "Severity", value: d.severity.charAt(0).toUpperCase() + d.severity.slice(1) });
        if (d.description) rows.push({ label: "Description", value: d.description });
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "pump": {
        const d = event.data as PumpData;
        if (d.side) rows.push({ label: "Side", value: d.side.charAt(0).toUpperCase() + d.side.slice(1) });
        if (d.amountMl != null) {
          const displayAmt = units === "oz"
            ? `${(d.amountMl * 0.033814).toFixed(1)} oz`
            : `${d.amountMl} ml`;
          rows.push({ label: "Amount", value: displayAmt });
        }
        if (d.durationMin != null) {
          rows.push({ label: "Duration", value: formatDuration(d.durationMin) });
        }
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "formula_prep": {
        const d = event.data as FormulaPrepData;
        if (d.amountMl != null) {
          const displayAmt = units === "oz"
            ? `${(d.amountMl * 0.033814).toFixed(1)} oz`
            : `${d.amountMl} ml`;
          rows.push({ label: "Amount", value: displayAmt });
        }
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
      case "medication": {
        const d = event.data as MedicationData;
        rows.push({ label: "Medication", value: d.name });
        if (d.dosage) rows.push({ label: "Dosage", value: d.dosage });
        if (d.frequency) rows.push({ label: "Frequency", value: d.frequency });
        if (d.notes) rows.push({ label: "Notes", value: d.notes });
        break;
      }
    }

    return rows;
  };

  const detailRows = renderDetailRows();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.closeBtn, { color: colors.muted }]}>Close</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Event Details</Text>
          {onEdit ? (
            <Pressable onPress={onEdit} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <Text style={[styles.editBtn, { color: typeColor }]}>Edit</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Type Badge */}
          <View style={styles.typeBadgeSection}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
              <IconSymbol name={getTypeIcon()} size={32} color={typeColor} />
            </View>
            <Text style={[styles.typeLabel, { color: typeColor }]}>{getTypeLabel()}</Text>
            <Text style={[styles.dateTimeText, { color: colors.muted }]}>
              {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
            </Text>
          </View>

          {/* Detail Rows */}
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {detailRows.length > 0 ? (
              detailRows.map((row, i) => (
                <View
                  key={i}
                  style={[
                    styles.detailRow,
                    i < detailRows.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.detailLabel, { color: colors.muted }]}>{row.label}</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
                </View>
              ))
            ) : (
              <View style={styles.detailRow}>
                <Text style={[styles.detailValue, { color: colors.muted }]}>No additional details recorded</Text>
              </View>
            )}
          </View>

          {/* Logged By */}
          {event.loggedByName && (
            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="person.fill" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 8 }}>
                Logged by <Text style={{ fontWeight: "600", color: colors.foreground }}>{event.loggedByName}</Text>
              </Text>
            </View>
          )}

          {/* Created At */}
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="clock.fill" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 8 }}>
              Created {formatDate(event.createdAt)} at {formatTime(event.createdAt)}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  closeBtn: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  editBtn: {
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  typeBadgeSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  typeBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 14,
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
  },
  metaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
