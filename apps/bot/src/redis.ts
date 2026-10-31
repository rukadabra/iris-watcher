import { Redis } from "ioredis"

export function createRedis(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  })
  redis.on("error", (error: unknown) => {
    console.error("Redis error", error)
  })
  return redis
}

export async function connectRedis(redis: Redis): Promise<void> {
  await Promise.race([
    redis.connect(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Redis cannot be reached")), 15_000)
    }),
  ])
}
