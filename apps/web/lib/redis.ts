import { Redis } from "ioredis"

let redis: Redis | null = null

export function getRedis(): Redis {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("REDIS_URL is not set")
  if (!redis) {
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    })
    redis.on("error", () => {})
  }
  return redis
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedis()
  if (client.status === "wait") await client.connect()
  return client
}
