import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  type AppState,
  type BabyEvent,
  type BabyProfile,
  type AppSettings,
  type GrowthEntry,
  DEFAULT_STATE,
  StoreContext,
  generateId,
  loadState,
  saveActiveSleep,
  saveEvents,
  saveProfile,
  saveSettings,
  saveGrowthHistory,
} from "./store";
import { trpc } from "./trpc";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const syncMutation = trpc.events.sync.useMutation();
  const deleteMutation = trpc.events.delete.useMutation();
  const updateMutation = trpc.events.update.useMutation();

  const reload = useCallback(async () => {
    const s = await loadState();
    setState(s);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEvent = useCallback(
    async (event: Omit<BabyEvent, "id" | "createdAt">) => {
      const newEvent: BabyEvent = {
        ...event,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        const updated = [newEvent, ...prev.events];
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      // Try to sync to cloud in background
      try {
        await syncMutation.mutateAsync({
          events: [
            {
              clientId: newEvent.id,
              type: newEvent.type,
              eventTimestamp: newEvent.timestamp,
              data: JSON.stringify(newEvent.data),
            },
          ],
        });
      } catch {
        // Offline or not logged in — event is saved locally
      }
    },
    [syncMutation]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      setState((prev) => {
        const updated = prev.events.filter((e) => e.id !== id);
        saveEvents(updated);
        return { ...prev, events: updated };
      });
      // Try to delete from cloud
      try {
        await deleteMutation.mutateAsync({ clientId: id });
      } catch {
        // Offline or not logged in
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
      // Try to update in cloud
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

  const updateProfile = useCallback(async (profile: BabyProfile) => {
    setState((prev) => ({ ...prev, profile }));
    await saveProfile(profile);
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setState((prev) => {
      const updated = { ...prev.settings, ...partial };
      saveSettings(updated);
      return { ...prev, settings: updated };
    });
  }, []);

  const startSleep = useCallback(async () => {
    const activeSleep = { startTime: new Date().toISOString() };
    setState((prev) => ({ ...prev, activeSleep }));
    await saveActiveSleep(activeSleep);
  }, []);

  const addGrowthEntry = useCallback(
    async (entry: Omit<GrowthEntry, "id" | "createdAt">) => {
      const newEntry: GrowthEntry = {
        ...entry,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        const updated = [newEntry, ...prev.growthHistory];
        saveGrowthHistory(updated);
        return { ...prev, growthHistory: updated };
      });
    },
    []
  );

  const deleteGrowthEntry = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.growthHistory.filter((e) => e.id !== id);
      saveGrowthHistory(updated);
      return { ...prev, growthHistory: updated };
    });
  }, []);

  const importEvents = useCallback(
    async (events: Omit<BabyEvent, "id" | "createdAt">[]): Promise<number> => {
      const newEvents: BabyEvent[] = events.map((e) => ({
        ...e,
        id: generateId() + Math.random().toString(36).slice(2, 4),
        createdAt: new Date().toISOString(),
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
          await syncMutation.mutateAsync({
            events: newEvents.map((e) => ({
              clientId: e.id,
              type: e.type,
              eventTimestamp: e.timestamp,
              data: JSON.stringify(e.data),
            })),
          });
        } catch {
          // Offline or not logged in
        }
        return count as number;
      });
    },
    [syncMutation]
  );

  const syncToCloud = useCallback(async () => {
    try {
      // Get current state and sync all events
      const currentState = await loadState();
      const eventsToSync = currentState.events.map((e) => ({
        clientId: e.id,
        type: e.type,
        eventTimestamp: e.timestamp,
        data: JSON.stringify(e.data),
      }));
      if (eventsToSync.length > 0) {
        // Batch in chunks of 100
        for (let i = 0; i < eventsToSync.length; i += 100) {
          const batch = eventsToSync.slice(i, i + 100);
          await syncMutation.mutateAsync({ events: batch });
        }
      }
    } catch (err) {
      console.warn("Cloud sync failed:", err);
      throw err;
    }
  }, [syncMutation]);

  const loadFromCloud = useCallback(async () => {
    // This is called via trpc query in the component that needs it
    // We'll implement it as a direct fetch
    try {
      const response = await fetch(
        `${require("@/constants/oauth").getApiBaseUrl()}/api/trpc/events.list`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await require("@/lib/_core/auth").getSessionToken()}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch cloud events");
      const json = await response.json();
      // tRPC batch response format
      const result = json?.result?.data;
      if (!result || !Array.isArray(result)) return;

      // Convert cloud events to local format
      const cloudEvents: BabyEvent[] = result.map((ce: any) => ({
        id: ce.clientId,
        type: ce.type,
        timestamp: ce.eventTimestamp,
        data: typeof ce.data === "string" ? JSON.parse(ce.data) : ce.data,
        createdAt: ce.createdAt || new Date().toISOString(),
      }));

      // Merge with local events (cloud wins for same clientId)
      setState((prev) => {
        const localMap = new Map(prev.events.map((e) => [e.id, e]));
        for (const ce of cloudEvents) {
          localMap.set(ce.id, ce);
        }
        const merged = Array.from(localMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        saveEvents(merged);
        return { ...prev, events: merged };
      });
    } catch (err) {
      console.warn("Load from cloud failed:", err);
    }
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
                data: JSON.stringify(newEvent.data),
              },
            ],
          })
          .catch(() => {});
        resolve(newEvent);
        return { ...prev, events: updatedEvents, activeSleep: null };
      });
    });
  }, [syncMutation]);

  if (!loaded) return null;

  return (
    <StoreContext.Provider
      value={{
        state,
        addEvent,
        deleteEvent,
        updateEvent,
        updateProfile,
        updateSettings,
        startSleep,
        stopSleep,
        addGrowthEntry,
        deleteGrowthEntry,
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
