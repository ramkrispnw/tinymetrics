import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useStore } from "@/lib/store";
import {
  type MilestoneCategory,
  MILESTONE_CATEGORIES,
  type Milestone,
} from "@/lib/store";
import { pickImage, uploadPhotoToCloud } from "@/lib/image-utils";

export default function MilestonesScreen() {
  const colors = useColors();
  const { state, addMilestone, deleteMilestone } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState<MilestoneCategory | "all">("all");
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const filtered = useMemo(() => {
    if (filterCat === "all") return state.milestones;
    return state.milestones.filter((m) => m.category === filterCat);
  }, [state.milestones, filterCat]);

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Milestones</Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [
            s.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        <Pressable
          onPress={() => setFilterCat("all")}
          style={({ pressed }) => [
            s.filterChip,
            {
              backgroundColor: filterCat === "all" ? colors.primary + "25" : colors.surface,
              borderColor: filterCat === "all" ? colors.primary : colors.border + "80",
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              s.filterChipText,
              {
                color: filterCat === "all" ? colors.primary : colors.foreground,
                fontWeight: filterCat === "all" ? "700" : "600",
              },
            ]}
          >
            All
          </Text>
        </Pressable>
        {MILESTONE_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => setFilterCat(cat.key)}
            style={({ pressed }) => [
              s.filterChip,
              {
                backgroundColor: filterCat === cat.key ? colors.primary + "25" : colors.surface,
                borderColor: filterCat === cat.key ? colors.primary : colors.border + "80",
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                s.filterChipText,
                {
                  color: filterCat === cat.key ? colors.primary : colors.foreground,
                  fontWeight: filterCat === cat.key ? "700" : "600",
                },
              ]}
            >
              {cat.icon} {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Milestone List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={[s.emptyIcon]}>⭐</Text>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>
              No milestones yet
            </Text>
            <Text style={[s.emptySubtitle, { color: colors.muted }]}>
              Tap "Add" to record your baby's first moments
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MilestoneCard
            milestone={item}
            colors={colors}
            onTap={() => setSelectedMilestone(item)}
            onDelete={() => {
              if (Platform.OS === "web") {
                if (confirm("Delete this milestone?")) {
                  deleteMilestone(item.id);
                }
              } else {
                Alert.alert("Delete Milestone", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteMilestone(item.id),
                  },
                ]);
              }
            }}
          />
        )}
      />

      {/* Add Milestone Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <AddMilestoneSheet
          colors={colors}
          onSave={(m) => {
            addMilestone(m);
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      </Modal>

      {/* Milestone Detail Sheet */}
      <Modal
        visible={!!selectedMilestone}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMilestone(null)}
      >
        {selectedMilestone && (
          <MilestoneDetailSheet
            milestone={selectedMilestone}
            colors={colors}
            onClose={() => setSelectedMilestone(null)}
            onDelete={() => {
              if (Platform.OS === "web") {
                if (confirm("Delete this milestone?")) {
                  deleteMilestone(selectedMilestone.id);
                  setSelectedMilestone(null);
                }
              } else {
                Alert.alert("Delete Milestone", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteMilestone(selectedMilestone.id);
                      setSelectedMilestone(null);
                    },
                  },
                ]);
              }
            }}
          />
        )}
      </Modal>
    </ScreenContainer>
  );
}

function MilestoneCard({
  milestone,
  colors,
  onTap,
  onDelete,
}: {
  milestone: Milestone;
  colors: any;
  onTap: () => void;
  onDelete: () => void;
}) {
  const cat = MILESTONE_CATEGORIES.find((c) => c.key === milestone.category);
  const dateStr = new Date(milestone.date + "T00:00:00").toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [s.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={s.cardIcon}>{cat?.icon || "⭐"}</Text>
          <View style={s.cardInfo}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>
              {milestone.title}
            </Text>
            <Text style={[s.cardDate, { color: colors.muted }]}>
              {dateStr} · {cat?.label || "Other"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}
        >
          <IconSymbol name="trash.fill" size={18} color={colors.error} />
        </Pressable>
      </View>
      {milestone.notes ? (
        <Text style={[s.cardNotes, { color: colors.muted }]}>
          {milestone.notes}
        </Text>
      ) : null}
      {milestone.photoUri ? (
        <Image source={{ uri: milestone.photoUri }} style={s.cardPhoto} />
      ) : null}
      {milestone.loggedByName ? (
        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>
          Logged by {milestone.loggedByName}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MilestoneDetailSheet({
  milestone,
  colors,
  onClose,
  onDelete,
}: {
  milestone: Milestone;
  colors: any;
  onClose: () => void;
  onDelete: () => void;
}) {
  const cat = MILESTONE_CATEGORIES.find((c) => c.key === milestone.category);
  const dateStr = new Date(milestone.date + "T00:00:00").toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const createdStr = new Date(milestone.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={[s.sheetContainer, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[s.sheetCancel, { color: colors.primary }]}>Close</Text>
        </Pressable>
        <Text style={[s.sheetTitle, { color: colors.foreground }]}>Milestone</Text>
        <Pressable onPress={onDelete} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}>
          <IconSymbol name="trash.fill" size={18} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Category badge + icon */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <Text style={{ fontSize: 56 }}>{cat?.icon || "⭐"}</Text>
          <View style={[s.catChip, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50", marginTop: 10 }]}>
            <Text style={[s.catChipText, { color: colors.primary }]}>{cat?.label || "Other"}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: 6 }}>
          {milestone.title}
        </Text>

        {/* Date */}
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 20 }}>
          {dateStr}
        </Text>

        {/* Photo */}
        {milestone.photoUri ? (
          <Image
            source={{ uri: milestone.photoUri }}
            style={{ width: "100%", height: 240, borderRadius: 14, marginBottom: 20, resizeMode: "cover" }}
          />
        ) : null}

        {/* Notes */}
        {milestone.notes ? (
          <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: colors.border }]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, letterSpacing: 0.5 }}>NOTES</Text>
            <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>{milestone.notes}</Text>
          </View>
        ) : null}

        {/* Metadata */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: colors.border }]}>
          {milestone.loggedByName ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Logged by</Text>
              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{milestone.loggedByName}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Recorded on</Text>
            <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{createdStr}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function AddMilestoneSheet({
  colors,
  onSave,
  onClose,
}: {
  colors: any;
  onSave: (m: Omit<Milestone, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [category, setCategory] = useState<MilestoneCategory>("motor");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [photoMime, setPhotoMime] = useState<string>("image/jpeg");
  const [saving, setSaving] = useState(false);

  const handlePickPhoto = async () => {
    const result = await pickImage("gallery");
    if (result) {
      setPhotoUri(result.uri);
      setPhotoBase64(result.base64);
      setPhotoMime(result.mimeType);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter a milestone title.");
      return;
    }
    setSaving(true);
    // Upload photo to cloud so all linked accounts can access it
    let finalPhotoUri = photoUri;
    if (photoBase64 && photoUri && !photoUri.startsWith("http")) {
      const cloudUrl = await uploadPhotoToCloud(photoBase64, photoMime);
      if (cloudUrl) finalPhotoUri = cloudUrl;
    }
    onSave({
      title: title.trim(),
      date,
      category,
      notes: notes.trim() || undefined,
      photoUri: finalPhotoUri,
    });
    setSaving(false);
  };

  return (
    <View style={[s.sheetContainer, { backgroundColor: colors.background }]}>
      {/* Sheet Header */}
      <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[s.sheetCancel, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[s.sheetTitle, { color: colors.foreground }]}>New Milestone</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [{ opacity: pressed || saving ? 0.6 : 1 }]}
        >
          <Text style={[s.sheetSave, { color: colors.primary }]}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.sheetContent}>
        {/* Title */}
        <Text style={[s.label, { color: colors.muted }]}>MILESTONE TITLE</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., First smile, First steps"
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
          ]}
          returnKeyType="done"
        />

        {/* Date */}
        <Text style={[s.label, { color: colors.muted }]}>DATE</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
          ]}
          returnKeyType="done"
        />

        {/* Category */}
        <Text style={[s.label, { color: colors.muted }]}>CATEGORY</Text>
        <View style={s.catGrid}>
          {MILESTONE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              style={({ pressed }) => [
                s.catChip,
                {
                  backgroundColor:
                    category === cat.key ? colors.primary : colors.surface,
                  borderColor: category === cat.key ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={s.catChipIcon}>{cat.icon}</Text>
              <Text
                style={[
                  s.catChipText,
                  { color: category === cat.key ? "#fff" : colors.foreground },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Notes */}
        <Text style={[s.label, { color: colors.muted }]}>NOTES (OPTIONAL)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any details..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
          style={[
            s.input,
            s.textArea,
            { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
          ]}
        />

        {/* Photo */}
        <Text style={[s.label, { color: colors.muted }]}>PHOTO (OPTIONAL)</Text>
        {photoUri ? (
          <View style={s.photoPreview}>
            <Image source={{ uri: photoUri }} style={s.previewImg} />
            <Pressable
              onPress={() => setPhotoUri(undefined)}
              style={({ pressed }) => [
                s.removePhotoBtn,
                { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <IconSymbol name="xmark" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handlePickPhoto}
            style={({ pressed }) => [
              s.photoBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="camera.fill" size={24} color={colors.muted} />
            <Text style={[s.photoBtnText, { color: colors.muted }]}>
              Add Photo
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 28, fontWeight: "700" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, flexGrow: 0 },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    alignSelf: "stretch",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 },
  cardIcon: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardDate: { fontSize: 12, marginTop: 2 },
  cardNotes: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  cardPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 10,
  },
  // Sheet
  sheetContainer: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  sheetCancel: { fontSize: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetSave: { fontSize: 16, fontWeight: "600" },
  sheetContent: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 16, letterSpacing: 0.5 },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 0.5,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  catChipIcon: { fontSize: 16 },
  catChipText: { fontSize: 13, fontWeight: "600" },
  photoBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 8,
  },
  photoBtnText: { fontSize: 14, fontWeight: "500" },
  photoPreview: { position: "relative" },
  previewImg: { width: "100%", height: 200, borderRadius: 12 },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
