import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QueuedEvent {
  id: string;
  clientId: string;
  type: string;
  eventTimestamp: string;
  data: string;
  retryCount: number;
  lastRetryTime?: number;
  createdAt: number;
}

const QUEUE_KEY = "baby_tracker_offline_queue";
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds

/**
 * Offline Event Queue Manager
 * Persists failed sync events and manages retry logic
 */
export class OfflineEventQueue {
  private queue: QueuedEvent[] = [];
  private isLoaded = false;

  /**
   * Load queue from storage
   */
  async load(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      this.queue = stored ? JSON.parse(stored) : [];
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to load offline queue:", error);
      this.queue = [];
      this.isLoaded = true;
    }
  }

  /**
   * Save queue to storage
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to save offline queue:", error);
    }
  }

  /**
   * Add event to queue
   */
  async add(event: Omit<QueuedEvent, "retryCount" | "createdAt">): Promise<void> {
    if (!this.isLoaded) await this.load();

    const queuedEvent: QueuedEvent = {
      ...event,
      retryCount: 0,
      createdAt: Date.now(),
    };

    this.queue.push(queuedEvent);
    await this.save();
  }

  /**
   * Get all queued events
   */
  async getAll(): Promise<QueuedEvent[]> {
    if (!this.isLoaded) await this.load();
    return [...this.queue];
  }

  /**
   * Get events ready for retry
   */
  async getReadyForRetry(): Promise<QueuedEvent[]> {
    if (!this.isLoaded) await this.load();

    const now = Date.now();
    return this.queue.filter((event) => {
      if (event.retryCount >= MAX_RETRIES) return false;

      const lastRetry = event.lastRetryTime || event.createdAt;
      const delay = this.getRetryDelay(event.retryCount);
      return now - lastRetry >= delay;
    });
  }

  /**
   * Mark event as synced and remove from queue
   */
  async markSynced(clientId: string): Promise<void> {
    if (!this.isLoaded) await this.load();

    this.queue = this.queue.filter((e) => e.clientId !== clientId);
    await this.save();
  }

  /**
   * Increment retry count for event
   */
  async incrementRetry(clientId: string): Promise<void> {
    if (!this.isLoaded) await this.load();

    const event = this.queue.find((e) => e.clientId === clientId);
    if (event) {
      event.retryCount += 1;
      event.lastRetryTime = Date.now();
      await this.save();
    }
  }

  /**
   * Clear all queued events
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  /**
   * Get queue size
   */
  getSize(): number {
    return this.queue.length;
  }

  /**
   * Check if event is in queue
   */
  has(clientId: string): boolean {
    return this.queue.some((e) => e.clientId === clientId);
  }
}

// Singleton instance
export const offlineQueue = new OfflineEventQueue();
