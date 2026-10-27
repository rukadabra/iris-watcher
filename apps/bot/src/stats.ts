import { STATS_GUILDS_KEY, STATS_HEARTBEAT_KEY } from "@iris/shared"
import type { Redis } from "ioredis"
import type { Client } from "discord.js"

export function startStats(client: Client, redis: Redis): NodeJS.Timeout {
  const write = async () => {
    if (!client.isReady()) return
    await redis.set(STATS_GUILDS_KEY, String(client.guilds.cache.size))
    await redis.set(STATS_HEARTBEAT_KEY, new Date().toISOString())
  }

  void write().catch((error: unknown) => console.error(error))
  return setInterval(() => {
    void write().catch((error: unknown) => console.error(error))
  }, 30_000)
}
