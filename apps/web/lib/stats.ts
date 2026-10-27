import { STATS_GUILDS_KEY, STATS_HEARTBEAT_KEY } from "@iris/shared"
import { connectRedis } from "./redis"

export type LiveStats = {
  guilds: number
  online: boolean
}

export async function readStats(): Promise<LiveStats | null> {
  try {
    const redis = await connectRedis()
    const [guilds, heartbeat] = await Promise.all([
      redis.get(STATS_GUILDS_KEY),
      redis.get(STATS_HEARTBEAT_KEY),
    ])
    if (!heartbeat) return null
    const seenAt = Date.parse(heartbeat)
    if (Number.isNaN(seenAt)) return null
    return {
      guilds: guilds ? Number(guilds) : 0,
      online: Date.now() - seenAt < 45_000,
    }
  } catch {
    return null
  }
}
