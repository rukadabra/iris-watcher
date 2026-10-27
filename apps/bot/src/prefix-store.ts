import { getGuild, listGuildPrefixes } from "@iris/db"
import { guildPrefixKey, PREFIX_CHANNEL } from "@iris/shared"
import type { Redis } from "ioredis"

export type PrefixStore = {
  getPrefix: (guildId: string) => Promise<string>
  warm: () => Promise<void>
  close: () => Promise<void>
}

export async function createPrefixStore(redis: Redis, defaultPrefix: string): Promise<PrefixStore> {
  const cache = new Map<string, string>()
  const subscriber = redis.duplicate()
  subscriber.on("error", (error: unknown) => {
    console.error("Redis subscriber error", error)
  })
  if (subscriber.status === "wait") await subscriber.connect()
  await subscriber.subscribe(PREFIX_CHANNEL)
  subscriber.on("message", (channel, guildId) => {
    if (channel === PREFIX_CHANNEL) cache.delete(guildId)
  })

  async function warm(): Promise<void> {
    const rows = await listGuildPrefixes()
    const pipeline = redis.pipeline()
    for (const row of rows) {
      const prefix = row.prefix ?? defaultPrefix
      cache.set(row.id, prefix)
      pipeline.set(guildPrefixKey(row.id), prefix)
    }
    if (rows.length > 0) await pipeline.exec()
  }

  async function getPrefix(guildId: string): Promise<string> {
    const cached = cache.get(guildId)
    if (cached) return cached

    const stored = await redis.get(guildPrefixKey(guildId))
    if (stored) {
      cache.set(guildId, stored)
      return stored
    }

    const row = await getGuild(guildId)
    const prefix = row?.prefix ?? defaultPrefix
    cache.set(guildId, prefix)
    await redis.set(guildPrefixKey(guildId), prefix)
    return prefix
  }

  return {
    getPrefix,
    warm,
    close: async () => {
      await subscriber.quit()
    },
  }
}
