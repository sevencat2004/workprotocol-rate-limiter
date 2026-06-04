import type { RateLimitStore, RedisLikeClient } from "../types.js";

export class RedisStore implements RateLimitStore {
  constructor(private readonly client: RedisLikeClient) {}

  async increment(key: string, ttlMs: number): Promise<number> {
    const value = Number(await this.client.incr(key));
    if (value === 1) {
      await this.client.pexpire(key, ttlMs);
    }
    return value;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "PX", ttlMs);
  }

  async zAdd(key: string, score: number, member: string, ttlMs: number): Promise<void> {
    await this.client.zadd(key, score, member);
    await this.client.pexpire(key, ttlMs);
  }

  async zRemoveRangeByScore(key: string, min: number, max: number): Promise<void> {
    await this.client.zremrangebyscore(key, min, max);
  }

  async zCount(key: string): Promise<number> {
    return Number(await this.client.zcard(key));
  }
}
