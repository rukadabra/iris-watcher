import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "./client"
import { guilds, liveWatches, type LiveWatch } from "./schema"

export async function listLiveWatches(): Promise<LiveWatch[]> {
  return getDb().select().from(liveWatches)
}

export async function setGuildLiveChannel(guildId: string, discordChannelId: string): Promise<void> {
  const db = getDb()
  await db
    .update(guilds)
    .set({ liveChannelId: discordChannelId, updatedAt: new Date() })
    .where(eq(guilds.id, guildId))
  await db.update(liveWatches).set({ discordChannelId }).where(eq(liveWatches.guildId, guildId))
}

export async function listGuildLiveWatches(guildId: string): Promise<LiveWatch[]> {
  return getDb().select().from(liveWatches).where(eq(liveWatches.guildId, guildId))
}

export async function listLiveWatchesByGuildIds(guildIds: string[]): Promise<LiveWatch[]> {
  if (guildIds.length === 0) return []
  return getDb().select().from(liveWatches).where(inArray(liveWatches.guildId, guildIds))
}

export async function saveLiveWatch(
  guildId: string,
  discordChannelId: string,
  youtubeChannelId: string,
  name: string,
): Promise<"created" | "moved" | "same" | "full"> {
  const db = getDb()
  const existing = await db
    .select()
    .from(liveWatches)
    .where(and(eq(liveWatches.guildId, guildId), eq(liveWatches.youtubeChannelId, youtubeChannelId)))
    .limit(1)
  const current = existing[0]
  if (current) {
    const turnedOn = !current.enabled
    if (current.discordChannelId === discordChannelId && current.enabled && current.name === name) return "same"
    await db
      .update(liveWatches)
      .set({
        discordChannelId,
        name,
        enabled: true,
        liveVideoId: turnedOn ? null : current.liveVideoId,
      })
      .where(and(eq(liveWatches.guildId, guildId), eq(liveWatches.youtubeChannelId, youtubeChannelId)))
    if (turnedOn) return "created"
    return current.discordChannelId === discordChannelId ? "same" : "moved"
  }

  const rows = await listGuildLiveWatches(guildId)
  if (rows.length >= 50) return "full"
  await db.insert(liveWatches).values({ guildId, discordChannelId, youtubeChannelId, name })
  return "created"
}

export async function removeLiveWatch(guildId: string, youtubeChannelId: string): Promise<LiveWatch | null> {
  const rows = await getDb()
    .delete(liveWatches)
    .where(and(eq(liveWatches.guildId, guildId), eq(liveWatches.youtubeChannelId, youtubeChannelId)))
    .returning()
  return rows[0] ?? null
}

export async function setLiveWatchEnabled(
  guildId: string,
  youtubeChannelId: string,
  enabled: boolean,
): Promise<LiveWatch | null> {
  const rows = await getDb()
    .update(liveWatches)
    .set({ enabled, liveVideoId: null })
    .where(and(eq(liveWatches.guildId, guildId), eq(liveWatches.youtubeChannelId, youtubeChannelId)))
    .returning()
  return rows[0] ?? null
}

export async function setLiveVideo(
  guildId: string,
  youtubeChannelId: string,
  liveVideoId: string | null,
): Promise<void> {
  await getDb()
    .update(liveWatches)
    .set({ liveVideoId })
    .where(and(eq(liveWatches.guildId, guildId), eq(liveWatches.youtubeChannelId, youtubeChannelId)))
}
