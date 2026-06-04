import type { RateLimitStore } from "../types.js";

interface Entry {
  value: unknown;
  expiresAt: number;
}

interface SortedSetEntry {
  score: number;
  member: string;
  expiresAt: number;
}

export class MemoryStore implements RateLimitStore {
  private values = new Map<string, Entry>();
  private sortedSets = new Map<string, SortedSetEntry[]>();

  async increment(key: string, ttlMs: number): Promise<number> {
    this.sweepKey(key);
    const current = this.values.get(key);
    const next = typeof current?.value === "number" ? current.value + 1 : 1;
    this.values.set(key, { value: next, expiresAt: Date.now() + ttlMs });
    return next;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.sweepKey(key);
    return this.values.get(key)?.value as T | undefined;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async zAdd(key: string, score: number, member: string, ttlMs: number): Promise<void> {
    this.sweepSortedSet(key);
    const existing = this.sortedSets.get(key) ?? [];
    existing.push({ score, member, expiresAt: Date.now() + ttlMs });
    this.sortedSets.set(key, existing);
  }

  async zRemoveRangeByScore(key: string, min: number, max: number): Promise<void> {
    this.sweepSortedSet(key);
    const existing = this.sortedSets.get(key) ?? [];
    this.sortedSets.set(
      key,
      existing.filter((entry) => entry.score < min || entry.score > max)
    );
  }

  async zCount(key: string): Promise<number> {
    this.sweepSortedSet(key);
    return this.sortedSets.get(key)?.length ?? 0;
  }

  private sweepKey(key: string): void {
    const entry = this.values.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
    }
  }

  private sweepSortedSet(key: string): void {
    const entries = this.sortedSets.get(key);
    if (!entries) return;
    const now = Date.now();
    const fresh = entries.filter((entry) => entry.expiresAt > now);
    if (fresh.length === 0) {
      this.sortedSets.delete(key);
    } else {
      this.sortedSets.set(key, fresh);
    }
  }
}
