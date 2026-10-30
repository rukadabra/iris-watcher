import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "./client"
import { guildAi } from "./schema"

export type GuildAiControls = {
  reasoning: boolean
  persona: string
  temperatureTenths: number | null
  chatChannelIds: string[]
  channelContext: boolean
  timeZone: string | null
}

export type GuildAiSummary = GuildAiControls & {
  guildId: string
  provider: string
  model: string
  keyHint: string
}

export type GuildAiSecret = GuildAiControls & {
  provider: string
  model: string
  keySealed: string
}

const controls = {
  reasoning: guildAi.reasoning,
  persona: guildAi.persona,
  temperatureTenths: guildAi.temperatureTenths,
  chatChannelIds: guildAi.chatChannelIds,
  channelContext: guildAi.channelContext,
  timeZone: guildAi.timeZone,
}

export async function listGuildAiByIds(ids: string[]): Promise<GuildAiSummary[]> {
  if (ids.length === 0) return []
  return getDb()
    .select({
      guildId: guildAi.guildId,
      provider: guildAi.provider,
      model: guildAi.model,
      keyHint: guildAi.keyHint,
      ...controls,
    })
    .from(guildAi)
    .where(inArray(guildAi.guildId, ids))
}

export async function getGuildAiSecret(guildId: string): Promise<GuildAiSecret | null> {
  const rows = await getDb()
    .select({
      provider: guildAi.provider,
      model: guildAi.model,
      keySealed: guildAi.keySealed,
      ...controls,
    })
    .from(guildAi)
    .where(eq(guildAi.guildId, guildId))
    .limit(1)
  return rows[0] ?? null
}

export async function saveGuildAi(
  guildId: string,
  value: GuildAiControls & {
    provider: string
    model: string
    keySealed: string
    keyHint: string
  },
): Promise<void> {
  const updatedAt = new Date()
  await getDb()
    .insert(guildAi)
    .values({ guildId, ...value, updatedAt })
    .onConflictDoUpdate({ target: guildAi.guildId, set: { ...value, updatedAt } })
}

export async function resealGuildAi(guildId: string, from: string, to: string): Promise<void> {
  await getDb()
    .update(guildAi)
    .set({ keySealed: to })
    .where(and(eq(guildAi.guildId, guildId), eq(guildAi.keySealed, from)))
}

export async function removeGuildAi(guildId: string): Promise<boolean> {
  const rows = await getDb().delete(guildAi).where(eq(guildAi.guildId, guildId)).returning({ guildId: guildAi.guildId })
  return rows.length > 0
}
