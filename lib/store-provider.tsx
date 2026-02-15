import React, { useCallback, useEffect, useState } from "react";
import {
  AppState as RNAppState,
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

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
    },
    []
  );

  const deleteEvent = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.events.filter((e) => e.id !== id);
      saveEvents(updated);
      return { ...prev, events: updated };
    });
  }, []);

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
      });
    },
    []
  );

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
        resolve(newEvent);
        return { ...prev, events: updatedEvents, activeSleep: null };
      });
    });
  }, []);

  if (!loaded) return null;

  return (
    <StoreContext.Provider
      value={{
        state,
        addEvent,
        deleteEvent,
        updateProfile,
        updateSettings,
        startSleep,
        stopSleep,
        addGrowthEntry,
        deleteGrowthEntry,
        importEvents,
        reload,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
