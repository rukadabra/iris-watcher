import { eq, inArray } from "drizzle-orm"
import { getDb } from "./client"
import { guilds, type GuildRecord } from "./schema"

export async function upsertGuild(id: string, name: string): Promise<void> {
  const db = getDb()
  await db
    .insert(guilds)
    .values({ id, name })
    .onConflictDoUpdate({
      target: guilds.id,
      set: { name, updatedAt: new Date() },
    })
}

export async function getGuild(id: string): Promise<GuildRecord | null> {
  const rows = await getDb().select().from(guilds).where(eq(guilds.id, id)).limit(1)
  return rows[0] ?? null
}

export async function listGuildPrefixes(): Promise<Pick<GuildRecord, "id" | "prefix">[]> {
  return getDb().select({ id: guilds.id, prefix: guilds.prefix }).from(guilds)
}

export async function listGuildsByIds(ids: string[]): Promise<GuildRecord[]> {
  if (ids.length === 0) return []
  return getDb().select().from(guilds).where(inArray(guilds.id, ids))
}

export async function setDisabledCommands(id: string, names: string[]): Promise<boolean> {
  const rows = await getDb()
    .update(guilds)
    .set({ disabledCommands: names, updatedAt: new Date() })
    .where(eq(guilds.id, id))
    .returning({ id: guilds.id })
  return rows.length > 0
}

const VOLUME_DEFAULT = 10

export async function getGuildVolume(id: string): Promise<number> {
  const rows = await getDb().select({ volume: guilds.volume }).from(guilds).where(eq(guilds.id, id)).limit(1)
  return rows[0]?.volume ?? VOLUME_DEFAULT
}

export async function setGuildVolume(id: string, volume: number): Promise<void> {
  const updated = await getDb()
    .update(guilds)
    .set({ volume, updatedAt: new Date() })
    .where(eq(guilds.id, id))
    .returning({ id: guilds.id })
  if (updated.length > 0) return
  await getDb().insert(guilds).values({ id, volume }).onConflictDoUpdate({
    target: guilds.id,
    set: { volume, updatedAt: new Date() },
  })
}

export async function setGuildPrefix(id: string, prefix: string | null): Promise<boolean> {
  const rows = await getDb()
    .update(guilds)
    .set({ prefix, updatedAt: new Date() })
    .where(eq(guilds.id, id))
    .returning({ id: guilds.id })
  return rows.length > 0
}
