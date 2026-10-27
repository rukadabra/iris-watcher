import { closeDb, migrate } from "@iris/db"
import { loadEnvFile } from "@iris/shared"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { client } from "./client"
import { createCommandStore } from "./command-store"
import { loadEnv } from "./env"
import { startHealth } from "./health"
import { createPrefixStore } from "./prefix-store"
import { connectRedis, createRedis } from "./redis"
import { startLiveWatch } from "./live"
import { registerEvents } from "./register"
import { startStats } from "./stats"
import { closeVoice } from "./voice"

loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"))

async function main(): Promise<void> {
  const env = loadEnv()
  process.env.DATABASE_URL = env.DATABASE_URL

  await migrate()
  const redis = createRedis(env.REDIS_URL)
  await connectRedis(redis)

  const prefixes = await createPrefixStore(redis, env.DEFAULT_PREFIX)
  await prefixes.warm()
  const commandGate = await createCommandStore(redis)

  const health = startHealth(env.HEALTH_PORT, () => ({
    ok: client.isReady(),
    guilds: client.guilds.cache.size,
  }))
  const stats = startStats(client, redis)
  const lives = startLiveWatch(client, env, redis)
  registerEvents(client, prefixes, commandGate, env)

  const shutdown = async () => {
    clearInterval(stats)
    health.close()
    closeVoice()
    client.destroy()
    await lives.close()
    await commandGate.close()
    await prefixes.close()
    await redis.quit()
    await closeDb()
  }

  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0))
  })
  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0))
  })

  await client.login(env.DISCORD_TOKEN)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
