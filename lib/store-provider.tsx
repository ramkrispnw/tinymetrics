import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  type AppState,
  type BabyEvent,
  type BabyProfile,
  type AppSettings,
  type GrowthEntry,
  type Milestone,
  DEFAULT_STATE,
  StoreContext,
  generateId,
  loadState,
  saveActiveSleep,
  saveEvents,
  saveProfile,
  saveSettings,
  saveGrowthHistory,
  saveMilestones,
  saveLastSynced,
  getEventDetailSummary,
} from "./store";
import { trpc, getVanillaClient } from "./trpc";
import { useAuth } from "@/hooks/use-auth";
import { sendPartnerActivityNotification } from "./notifications";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth({ autoFetch: true });
  const currentUserId = user?.id?.toString() || undefined;
  const currentUserName = user?.name || undefined;
  const syncMutation = trpc.events.sync.useMutation();
  const deleteMutation = trpc.events.delete.useMutation();
  const updateMutation = trpc.events.update.useMutation();

  // Household data sync mutations
  const syncProfileMutation = trpc.household.syncProfile.useMutation();
  const syncGrowthMutation = trpc.household.syncGrowth.useMutation();
  const syncMilestonesMutation = trpc.household.syncMilestones.useMutation();

  const syncInProgressRef = useRef(false);

  const reload = useCallback(async () => {
    const s = await loadState();
    setState(s);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ─── Cloud Sync: Push all local data to cloud ─────────────────────────────

  const syncToCloud = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    try {
      const currentState = await loadState();

      // 1. Sync events in batches of 100
      const eventsToSync = currentState.events.map((e) => ({
        clientId: e.id,
        type: e.type,
        eventTimestamp: e.timestamp,
        data: JSON.stringify({ ...e.data, _loggedBy: e.loggedBy, _loggedByName: e.loggedByName }),
      }));
      for (let i = 0; i < eventsToSync.length; i += 100) {
        const batch = eventsToSync.slice(i, i + 100);
        await syncMutation.mutateAsync({ events: batch });
      }

      // 2. Sync profile
      if (currentState.profile) {
        await syncProfileMutation.mutateAsync({
          profile: JSON.stringify(currentState.profile),
        });
      }

      // 3. Sync growth history
      if (currentState.growthHistory.length > 0) {
        await syncGrowthMutation.mutateAsync({
          growthHistory: JSON.stringify(currentState.growthHistory),
        });
      }

      // 4. Sync milestones
      if (currentState.milestones.length > 0) {
        await syncMilestonesMutation.mutateAsync({
          milestones: JSON.stringify(currentState.milestones),
        });
      }

      const now = new Date().toISOString();
      setState((prev) => ({ ...prev, lastSyncedAt: now }));
      await saveLastSynced(now);
      console.log("[CloudSync] Push complete");
    } catch (err) {
      console.warn("[CloudSync] Push failed:", err);
      throw err;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [syncMutation, syncProfileMutation, syncGrowthMutation, syncMilestonesMutation]);

  // ─── Cloud Sync: Pull all cloud data and merge with local ─────────────────

  const loadFromCloud = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    try {
      const client = getVanillaClient();

      // 1. Pull events using vanilla tRPC client (proper superjson deserialization)
      let cloudEvents: Array<{
        id: number;
        clientId: string;
        type: string;
        eventTimestamp: string;
        data: string;
        userId: number;
        createdAt: Date | string;
      }> | null = null;

      try {
        cloudEvents = await client.events.list.query();
      } catch (err) {
        console.warn("[CloudSync] Failed to fetch events:", err);
      }

      // Fetch deleted event IDs so partner devices can purge them locally
      let deletedClientIds: string[] = [];
      try {
        deletedClientIds = await client.events.listDeleted.query();
      } catch (err) {
        console.warn("[CloudSync] Failed to fetch deleted event IDs:", err);
      }

      if (cloudEvents && Array.isArray(cloudEvents) && cloudEvents.length > 0) {
        const parsedEvents: BabyEvent[] = cloudEvents.map((ce) => {
          let parsedData: any;
          try {
            parsedData = typeof ce.data === "string" ? JSON.parse(ce.data) : ce.data;
          } catch {
            parsedData = {};
          }
          // Extract loggedBy info from data payload
          const loggedBy = parsedData?._loggedBy || ce.userId?.toString();
          const loggedByName = parsedData?._loggedByName || undefined;
          // Remove internal fields from data
          if (parsedData?._loggedBy) delete parsedData._loggedBy;
          if (parsedData?._loggedByName) delete parsedData._loggedByName;
          return {
            id: ce.clientId,
            type: ce.type as BabyEvent["type"],
            timestamp: ce.eventTimestamp,
            data: parsedData,
            createdAt: ce.createdAt
              ? typeof ce.createdAt === "string"
                ? ce.createdAt
                : (ce.createdAt as Date).toISOString()
              : new Date().toISOString(),
            loggedBy,
            loggedByName,
          };
        });

        setState((prev) => {
          // Merge: cloud wins for same clientId, keep local-only events
          // Strip any events that have been soft-deleted on the server (by any household member)
          const deletedSet = new Set(deletedClientIds);
          const mergedMap = new Map<string, BabyEvent>();
          for (const e of prev.events) {
            if (!deletedSet.has(e.id)) mergedMap.set(e.id, e);
          }
          // Detect new partner events for notifications
          const existingIds = new Set(prev.events.map((e) => e.id));
          const newPartnerEvents = parsedEvents.filter(
            (e) => !existingIds.has(e.id) && e.loggedBy && e.loggedBy !== currentUserId
          );
          for (const e of parsedEvents) {
            if (!deletedSet.has(e.id)) mergedMap.set(e.id, e);
          }
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          saveEvents(merged);

          // Send partner activity notifications if enabled
          if (prev.settings.notifications?.partnerActivity !== false && newPartnerEvents.length > 0) {
            for (const pe of newPartnerEvents.slice(0, 5)) {
              sendPartnerActivityNotification(
                pe.loggedByName || "Partner",
                pe.type,
              ).catch(() => {});
            }
          }

          return { ...prev, events: merged };
        });
        console.log(`[CloudSync] Pulled ${parsedEvents.length} events from cloud`);
      } else if (deletedClientIds.length > 0) {
        // No cloud events returned (all deleted or empty household), but we still need
        // to purge any locally-held events that were deleted by a partner.
        const deletedSet = new Set(deletedClientIds);
        setState((prev) => {
          const filtered = prev.events.filter((e) => !deletedSet.has(e.id));
          if (filtered.length !== prev.events.length) {
            saveEvents(filtered);
            return { ...prev, events: filtered };
          }
          return prev;
        });
        console.log(`[CloudSync] Purged ${deletedClientIds.length} deleted events from local store`);
      }

      // 2. Pull profile
      try {
        const cloudProfile = await client.household.getProfile.query();
        if (cloudProfile?.dataValue) {
          const profile = JSON.parse(cloudProfile.dataValue) as BabyProfile;
          setState((prev) => {
            // Cloud profile wins if it has a name (i.e., it's been set up)
            if (profile.name) {
              saveProfile(profile);
              return { ...prev, profile };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("[CloudSync] Failed to fetch profile:", err);
      }

      // 3. Pull growth history
      try {
        const cloudGrowth = await client.household.getGrowth.query();
        if (cloudGrowth?.dataValue) {
          const cloudGrowthEntries = JSON.parse(cloudGrowth.dataValue) as GrowthEntry[];
          setState((prev) => {
            // Merge: keep unique entries by id
            const mergedMap = new Map<string, GrowthEntry>();
            for (const e of prev.growthHistory) mergedMap.set(e.id, e);
            for (const e of cloudGrowthEntries) mergedMap.set(e.id, e);
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            saveGrowthHistory(merged);
            return { ...prev, growthHistory: merged };
          });
        }
      } catch (err) {
        console.warn("[CloudSync] Failed to fetch growth:", err);
      }

      // 4. Pull milestones
      try {
        const cloudMilestones = await client.household.getMilestones.query();
        if (cloudMilestones?.dataValue) {
          const cloudMilestoneEntries = JSON.parse(cloudMilestones.dataValue) as Milestone[];
          setState((prev) => {
            // Merge: keep unique milestones by id
            const mergedMap = new Map<string, Milestone>();
            for (const m of prev.milestones) mergedMap.set(m.id, m);
            for (const m of cloudMilestoneEntries) mergedMap.set(m.id, m);
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            saveMilestones(merged);
            return { ...prev, milestones: merged };
          });
        }
      } catch (err) {
        console.warn("[CloudSync] Failed to fetch milestones:", err);
      }

      const now = new Date().toISOString();
      setState((prev) => ({ ...prev, lastSyncedAt: now }));
      await saveLastSynced(now);
      console.log("[CloudSync] Pull complete");
    } catch (err) {
      console.warn("[CloudSync] Pull failed:", err);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [currentUserId]);

  // ─── Event CRUD (with cloud sync) ─────────────────────────────────────────

  const addEvent = useCallback(
    async (event: Omit<BabyEvent, "id" | "createdAt">) => {
      const newEvent: BabyEvent = {
        ...event,
        id: generateId(),
        createdAt: new Date().toISOString(),
        loggedBy: currentUserId,
        loggedByName: currentUserName,
      };
      setState((prev) => {
        const updated = [newEvent, ...prev.events];
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      // Sync to cloud in background
      try {
        await syncMutation.mutateAsync({
          events: [
            {
              clientId: newEvent.id,
              type: newEvent.type,
              eventTimestamp: newEvent.timestamp,
              data: JSON.stringify({ ...newEvent.data, _loggedBy: newEvent.loggedBy, _loggedByName: newEvent.loggedByName }),
            },
          ],
        });
      } catch {
        // Offline or not logged in — event is saved locally
      }
    },
    [syncMutation, currentUserId, currentUserName]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      // Capture the event before removing it so we can create an audit entry
      let deletedEvent: BabyEvent | undefined;
      setState((prev) => {
        deletedEvent = prev.events.find((e) => e.id === id);
        const updated = prev.events.filter((e) => e.id !== id);
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      try {
        await deleteMutation.mutateAsync({ clientId: id });
      } catch {
        // Offline or not logged in
      }
      // Log a deletion_audit entry visible to all household members
      if (deletedEvent) {
        const auditId = generateId();
        const auditEvent: BabyEvent = {
          id: auditId,
          type: "deletion_audit",
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          loggedBy: currentUserId,
          loggedByName: currentUserName,
          data: {
            deletedEventLabel: (() => {
              const typeLabel = deletedEvent.type === "formula_prep"
                ? "Formula Prep"
                : deletedEvent.type.charAt(0).toUpperCase() + deletedEvent.type.slice(1).replace("_", " ");
              const detail = getEventDetailSummary(deletedEvent, state.settings.units as "ml" | "oz");
              return detail ? `${typeLabel} · ${detail}` : typeLabel;
            })(),
            deletedEventType: deletedEvent.type,
            deletedEventTimestamp: deletedEvent.timestamp,
            deletedByName: currentUserName || "Unknown",
          },
        };
        setState((prev) => {
          const updated = [auditEvent, ...prev.events];
          saveEvents(updated);
          return { ...prev, events: updated };
        });
        // Sync audit entry to cloud so partner sees it
        try {
          await syncMutation.mutateAsync({
            events: [{
              clientId: auditEvent.id,
              type: auditEvent.type,
              eventTimestamp: auditEvent.timestamp,
              data: JSON.stringify({ ...auditEvent.data, _loggedBy: auditEvent.loggedBy, _loggedByName: auditEvent.loggedByName }),
            }],
          });
        } catch {
          // Offline — audit entry is saved locally
        }
      }
    },
    [deleteMutation, syncMutation, currentUserId, currentUserName]
  );

  const deleteEvents = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setState((prev) => {
        const updated = prev.events.filter((e) => !idSet.has(e.id));
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      // Delete from cloud one by one (server doesn't have batch endpoint)
      for (const id of ids) {
        try {
          await deleteMutation.mutateAsync({ clientId: id });
        } catch {
          // Offline or not logged in
        }
      }
    },
    [deleteMutation]
  );

  const updateEvent = useCallback(
    async (id: string, updates: Partial<Omit<BabyEvent, "id" | "createdAt">>) => {
      setState((prev) => {
        const updated = prev.events.map((e) => {
          if (e.id !== id) return e;
          return { ...e, ...updates };
        });
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      try {
        const cloudUpdates: any = {};
        if (updates.type) cloudUpdates.type = updates.type;
        if (updates.timestamp) cloudUpdates.eventTimestamp = updates.timestamp;
        if (updates.data) cloudUpdates.data = JSON.stringify(updates.data);
        cloudUpdates.clientId = id;
        await updateMutation.mutateAsync(cloudUpdates);
      } catch {
        // Offline or not logged in
      }
    },
    [updateMutation]
  );

  // ─── Profile (with cloud sync) ────────────────────────────────────────────

  const updateProfile = useCallback(async (profile: BabyProfile) => {
    setState((prev) => {
      const oldProfile = prev.profile;
      const weightChanged = profile.weight != null && (oldProfile?.weight !== profile.weight || oldProfile?.weightUnit !== profile.weightUnit);
      const heightChanged = profile.height != null && (oldProfile?.height !== profile.height || oldProfile?.heightUnit !== profile.heightUnit);

      let updatedEvents = prev.events;
      if (weightChanged || heightChanged) {
        const growthEvent: BabyEvent = {
          id: generateId(),
          type: "growth",
          timestamp: new Date().toISOString(),
          data: {
            weight: profile.weight,
            weightUnit: profile.weightUnit || "kg",
            height: profile.height,
            heightUnit: profile.heightUnit || "cm",
            notes: "Profile updated",
          },
          createdAt: new Date().toISOString(),
          loggedBy: currentUserId,
          loggedByName: currentUserName,
        };
        updatedEvents = [growthEvent, ...prev.events];
        saveEvents(updatedEvents);
        // Sync growth event to cloud
        syncMutation.mutateAsync({
          events: [{
            clientId: growthEvent.id,
            type: growthEvent.type,
            eventTimestamp: growthEvent.timestamp,
            data: JSON.stringify({ ...growthEvent.data, _loggedBy: growthEvent.loggedBy, _loggedByName: growthEvent.loggedByName }),
          }],
        }).catch(() => {});
      }

      saveProfile(profile);
      // Sync profile to cloud
      syncProfileMutation.mutateAsync({
        profile: JSON.stringify(profile),
      }).catch(() => {});

      return { ...prev, profile, events: updatedEvents };
    });
  }, [syncMutation, syncProfileMutation]);

  // ─── Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setState((prev) => {
      const updated = { ...prev.settings, ...partial };
      saveSettings(updated);
      return { ...prev, settings: updated };
    });
  }, []);

  // ─── Sleep Timer ──────────────────────────────────────────────────────────

  const startSleep = useCallback(async () => {
    const activeSleep = { startTime: new Date().toISOString() };
    setState((prev) => ({ ...prev, activeSleep }));
    await saveActiveSleep(activeSleep);
  }, []);

  const stopSleep = useCallback(async (): Promise<BabyEvent | null> => {
    return new Promise((resolve) => {
      setState((prev) => {
        if (!prev.activeSleep) {
          resolve(null);
          return prev;
        }
        const start = new Date(prev.activeSleep.startTime);
        const end = new Date();
        const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
        const newEvent: BabyEvent = {
          id: generateId(),
          type: "sleep",
          timestamp: prev.activeSleep.startTime,
          data: {
            startTime: prev.activeSleep.startTime,
            endTime: end.toISOString(),
            durationMin,
          },
          createdAt: new Date().toISOString(),
          loggedBy: currentUserId,
          loggedByName: currentUserName,
        };
        const updatedEvents = [newEvent, ...prev.events];
        saveEvents(updatedEvents);
        saveActiveSleep(null);
        // Sync to cloud
        syncMutation
          .mutateAsync({
            events: [
              {
                clientId: newEvent.id,
                type: newEvent.type,
                eventTimestamp: newEvent.timestamp,
                data: JSON.stringify({ ...newEvent.data, _loggedBy: newEvent.loggedBy, _loggedByName: newEvent.loggedByName }),
              },
            ],
          })
          .catch(() => {});
        resolve(newEvent);
        return { ...prev, events: updatedEvents, activeSleep: null };
      });
    });
  }, [syncMutation, currentUserId, currentUserName]);

  // ─── Growth History (with cloud sync) ─────────────────────────────────────

  const addGrowthEntry = useCallback(
    async (entry: Omit<GrowthEntry, "id" | "createdAt">) => {
      const newEntry: GrowthEntry = {
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
        loggedBy: currentUserId,
        loggedByName: currentUserName,
      };
      const growthEvent: BabyEvent = {
        id: generateId(),
        type: "growth",
        timestamp: new Date(entry.date + "T12:00:00").toISOString(),
        data: {
          weight: entry.weight,
          weightUnit: entry.weightUnit || "kg",
          height: entry.height,
          heightUnit: entry.heightUnit || "cm",
          notes: "Growth log entry",
        },
        createdAt: new Date().toISOString(),
        loggedBy: currentUserId,
        loggedByName: currentUserName,
      };
      setState((prev) => {
        const updatedGrowth = [newEntry, ...prev.growthHistory];
        const updatedEvents = [growthEvent, ...prev.events];
        saveGrowthHistory(updatedGrowth);
        saveEvents(updatedEvents);

        // Auto-update baby profile with latest growth measurements
        let updatedProfile = prev.profile;
        if (updatedProfile) {
          const profileUpdates: Partial<BabyProfile> = {};
          if (entry.weight != null) {
            profileUpdates.weight = entry.weight;
            profileUpdates.weightUnit = entry.weightUnit || "kg";
          }
          if (entry.height != null) {
            profileUpdates.height = entry.height;
            profileUpdates.heightUnit = entry.heightUnit || "cm";
          }
          if ((entry as any).headCircumference != null) {
            (profileUpdates as any).headCircumference = (entry as any).headCircumference;
          }
          if (Object.keys(profileUpdates).length > 0) {
            updatedProfile = { ...updatedProfile, ...profileUpdates };
            saveProfile(updatedProfile);
            // Sync profile to cloud
            syncProfileMutation.mutateAsync({
              profile: JSON.stringify(updatedProfile),
            }).catch(() => {});
          }
        }

        // Sync growth history to cloud
        syncGrowthMutation.mutateAsync({
          growthHistory: JSON.stringify(updatedGrowth),
        }).catch(() => {});

        return { ...prev, growthHistory: updatedGrowth, events: updatedEvents, profile: updatedProfile || prev.profile };
      });
      // Sync growth event to cloud
      try {
        await syncMutation.mutateAsync({
          events: [{
            clientId: growthEvent.id,
            type: growthEvent.type,
            eventTimestamp: growthEvent.timestamp,
            data: JSON.stringify({ ...growthEvent.data, _loggedBy: growthEvent.loggedBy, _loggedByName: growthEvent.loggedByName }),
          }],
        });
      } catch {
        // Offline or not logged in
      }
    },
    [syncMutation, syncGrowthMutation, currentUserId, currentUserName]
  );

  const deleteGrowthEntry = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.growthHistory.filter((e) => e.id !== id);
      saveGrowthHistory(updated);
      // Sync updated growth history to cloud
      syncGrowthMutation.mutateAsync({
        growthHistory: JSON.stringify(updated),
      }).catch(() => {});
      return { ...prev, growthHistory: updated };
    });
  }, [syncGrowthMutation]);

  // ─── Milestones (with cloud sync) ─────────────────────────────────────────

  const addMilestone = useCallback(async (milestone: Omit<Milestone, "id" | "createdAt">) => {
    const newMilestone: Milestone = {
      ...milestone,
      id: generateId(),
      createdAt: new Date().toISOString(),
      loggedBy: currentUserId,
      loggedByName: currentUserName,
    };
    setState((prev) => {
      const updated = [newMilestone, ...prev.milestones].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      saveMilestones(updated);
      // Sync milestones to cloud
      syncMilestonesMutation.mutateAsync({
        milestones: JSON.stringify(updated),
      }).catch(() => {});
      return { ...prev, milestones: updated };
    });
  }, [syncMilestonesMutation, currentUserId, currentUserName]);

  const deleteMilestone = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.milestones.filter((m) => m.id !== id);
      saveMilestones(updated);
      // Sync updated milestones to cloud
      syncMilestonesMutation.mutateAsync({
        milestones: JSON.stringify(updated),
      }).catch(() => {});
      return { ...prev, milestones: updated };
    });
  }, [syncMilestonesMutation]);

  // ─── Import Events (with cloud sync) ──────────────────────────────────────

  const importEvents = useCallback(
    async (events: Omit<BabyEvent, "id" | "createdAt">[]): Promise<number> => {
      const newEvents: BabyEvent[] = events.map((e) => ({
        ...e,
        id: generateId() + Math.random().toString(36).slice(2, 4),
        createdAt: new Date().toISOString(),
        loggedBy: currentUserId,
        loggedByName: currentUserName,
      }));
      return new Promise((resolve) => {
        setState((prev) => {
          const merged = [...newEvents, ...prev.events].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          saveEvents(merged);
          resolve(newEvents.length);
          return { ...prev, events: merged };
        });
      }).then(async (count) => {
        // Sync imported events to cloud in background
        try {
          for (let i = 0; i < newEvents.length; i += 100) {
            const batch = newEvents.slice(i, i + 100);
            await syncMutation.mutateAsync({
              events: batch.map((e) => ({
                clientId: e.id,
                type: e.type,
                eventTimestamp: e.timestamp,
                data: JSON.stringify({ ...e.data, _loggedBy: e.loggedBy, _loggedByName: e.loggedByName }),
              })),
            });
          }
        } catch {
          // Offline or not logged in
        }
        return count as number;
      });
    },
    [syncMutation, currentUserId, currentUserName]
  );

  if (!loaded) return null;

  return (
    <StoreContext.Provider
      value={{
        state,
        addEvent,
        deleteEvent,
        deleteEvents,
        updateEvent,
        updateProfile,
        updateSettings,
        startSleep,
        stopSleep,
        addGrowthEntry,
        deleteGrowthEntry,
        addMilestone,
        deleteMilestone,
        importEvents,
        syncToCloud,
        loadFromCloud,
        reload,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
