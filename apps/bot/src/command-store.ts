import { getGuild } from "@iris/db"
import { COMMANDS_CHANNEL, guildCommandsKey, sanitizeDisabledCommands } from "@iris/shared"
import type { Redis } from "ioredis"

export type CommandStore = {
  disabled: (guildId: string) => Promise<ReadonlySet<string>>
  close: () => Promise<void>
}

export async function createCommandStore(redis: Redis): Promise<CommandStore> {
  const cache = new Map<string, ReadonlySet<string>>()
  const subscriber = redis.duplicate()
  subscriber.on("error", (error: unknown) => {
    console.error("Command subscriber error", error)
  })
  if (subscriber.status === "wait") await subscriber.connect()
  await subscriber.subscribe(COMMANDS_CHANNEL)
  subscriber.on("message", (channel, guildId) => {
    if (channel === COMMANDS_CHANNEL) cache.delete(guildId)
  })

  async function disabled(guildId: string): Promise<ReadonlySet<string>> {
    const cached = cache.get(guildId)
    if (cached) return cached

    const stored = await redis.get(guildCommandsKey(guildId))
    const names = stored === null ? await load(guildId, redis) : parseNames(stored)
    const set = new Set(names)
    cache.set(guildId, set)
    return set
  }

  return {
    disabled,
    close: async () => {
      await subscriber.quit()
    },
  }
}

async function load(guildId: string, redis: Redis): Promise<string[]> {
  const row = await getGuild(guildId)
  const names = sanitizeDisabledCommands(row?.disabledCommands ?? [])
  const encoded = JSON.stringify(names)
  const wrote = await redis.set(guildCommandsKey(guildId), encoded, "NX")
  if (wrote === "OK") return names
  const stored = await redis.get(guildCommandsKey(guildId))
  return stored === null ? names : parseNames(stored)
}

function parseNames(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return sanitizeDisabledCommands(value.filter((item): item is string => typeof item === "string"))
  } catch {
    return []
  }
}
