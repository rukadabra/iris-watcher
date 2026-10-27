"use server"

import {
  getGuild,
  migrate,
  removeLiveWatch,
  saveLiveWatch,
  setDisabledCommands,
  setGuildLiveChannel,
  setGuildPrefix,
  setLiveWatchEnabled,
} from "@iris/db"
import {
  canManageGuild,
  COMMANDS_CHANNEL,
  DEFAULT_PREFIX,
  guildCommandsKey,
  guildPrefixKey,
  isSnowflake,
  isToggleableCommand,
  LIVE_REFRESH_CHANNEL,
  parseChannelTarget,
  parseCustomPrefix,
  PREFIX_CHANNEL,
  sanitizeDisabledCommands,
} from "@iris/shared"
import { revalidatePath } from "next/cache"
import { fetchDiscordGuilds, fetchGuildTextChannels } from "@/lib/discord"
import { resolveYoutubeChannel } from "@/lib/player"
import { readWebEnv } from "@/lib/env"
import { connectRedis } from "@/lib/redis"
import { getSession } from "@/lib/session"
import type { PrefixActionState } from "@/lib/types"

export async function savePrefix(
  _state: PrefixActionState,
  formData: FormData,
): Promise<PrefixActionState> {
  const failed = (error: string): PrefixActionState => ({ error, saved: false })
  const config = readWebEnv()
  if (!config.ok) return failed(config.error)

  const session = await getSession()
  if (!session) return failed("Sign in with Discord to change the prefix")

  const guildId = String(formData.get("guildId") ?? "")
  if (!isSnowflake(guildId)) return failed("That server is not valid")

  const intent = String(formData.get("intent") ?? "save")
  let prefix: string | null
  if (intent === "reset") {
    prefix = null
  } else {
    const parsed = parseCustomPrefix(String(formData.get("prefix") ?? ""))
    if (!parsed.ok) return failed(parsed.error)
    prefix = parsed.prefix
  }

  try {
    const guilds = await fetchDiscordGuilds(session.accessToken)
    const allowed = guilds.find((guild) => guild.id === guildId && canManageGuild(guild.permissions, guild.owner))
    if (!allowed) return failed("You do not manage this server")

    process.env.DATABASE_URL = config.env.DATABASE_URL
    await migrate()
    const updated = await setGuildPrefix(guildId, prefix)
    if (!updated) return failed("Iris is not in this server")

    const redis = await connectRedis()
    await redis.set(guildPrefixKey(guildId), prefix ?? config.env.DEFAULT_PREFIX ?? DEFAULT_PREFIX)
    await redis.publish(PREFIX_CHANNEL, guildId)
  } catch (error) {
    console.error(error)
    return failed("The prefix could not be saved")
  }

  revalidatePath("/dashboard")
  return { error: "", saved: true }
}

const YOUTUBE_CHANNEL_ID = /^UC[\w-]{22}$/

async function prepare(guildId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = readWebEnv()
  if (!config.ok) return { ok: false, error: config.error }
  const session = await getSession()
  if (!session) return { ok: false, error: "Sign in with Discord to change this server" }
  if (!isSnowflake(guildId)) return { ok: false, error: "That server is not valid" }

  const listed = await fetchDiscordGuilds(session.accessToken)
  const allowed = listed.find((guild) => guild.id === guildId && canManageGuild(guild.permissions, guild.owner))
  if (!allowed) return { ok: false, error: "You do not manage this server" }

  process.env.DATABASE_URL = config.env.DATABASE_URL
  await migrate()
  return { ok: true }
}

function done(): PrefixActionState {
  revalidatePath("/dashboard")
  return { error: "", saved: true }
}

export async function saveAlertChannel(
  _state: PrefixActionState,
  formData: FormData,
): Promise<PrefixActionState> {
  const guildId = String(formData.get("guildId") ?? "")
  const channelId = String(formData.get("channelId") ?? "")
  const ready = await prepare(guildId)
  if (!ready.ok) return { error: ready.error, saved: false }
  if (!isSnowflake(channelId)) return { error: "Choose a text channel", saved: false }

  try {
    const channels = await fetchGuildTextChannels(guildId)
    if (!channels.some((channel) => channel.id === channelId)) {
      return { error: "Iris cannot use that channel", saved: false }
    }
    const guild = await getGuild(guildId)
    if (!guild) return { error: "Iris is not in this server", saved: false }
    await setGuildLiveChannel(guildId, channelId)
  } catch (error) {
    console.error(error)
    return { error: "The alert channel could not be saved", saved: false }
  }

  return done()
}

export async function addWatch(
  _state: PrefixActionState,
  formData: FormData,
): Promise<PrefixActionState> {
  const guildId = String(formData.get("guildId") ?? "")
  const ready = await prepare(guildId)
  if (!ready.ok) return { error: ready.error, saved: false }

  const target = parseChannelTarget(String(formData.get("target") ?? ""))
  if (!target) return { error: "Send a YouTube channel link or an @handle.", saved: false }

  try {
    const guild = await getGuild(guildId)
    if (!guild) return { error: "Iris is not in this server", saved: false }
    if (!guild.liveChannelId) return { error: "Choose the alert channel first.", saved: false }

    const found = await resolveYoutubeChannel(target)
    if (!found.ok) return { error: found.error, saved: false }
    if (!YOUTUBE_CHANNEL_ID.test(found.channel.id)) {
      return { error: "YouTube could not find that channel.", saved: false }
    }

    const saved = await saveLiveWatch(guildId, guild.liveChannelId, found.channel.id, found.channel.name)
    if (saved === "full") return { error: "This server already has 50 YouTube channels.", saved: false }
    if (saved === "same") return { error: "That channel is already on this server's list.", saved: false }
    if (saved === "created") {
      const redis = await connectRedis()
      await redis.publish(LIVE_REFRESH_CHANNEL, `${guildId} ${found.channel.id}`)
    }
  } catch (error) {
    console.error(error)
    return { error: "The channel could not be added", saved: false }
  }

  return done()
}

export async function updateWatch(
  _state: PrefixActionState,
  formData: FormData,
): Promise<PrefixActionState> {
  const guildId = String(formData.get("guildId") ?? "")
  const youtubeChannelId = String(formData.get("youtubeChannelId") ?? "")
  const intent = String(formData.get("intent") ?? "")
  const ready = await prepare(guildId)
  if (!ready.ok) return { error: ready.error, saved: false }
  if (!YOUTUBE_CHANNEL_ID.test(youtubeChannelId)) return { error: "That channel is not valid", saved: false }

  try {
    if (intent === "delete") {
      const removed = await removeLiveWatch(guildId, youtubeChannelId)
      if (!removed) return { error: "That channel is not on this server's list.", saved: false }
    } else if (intent === "on" || intent === "off") {
      const updated = await setLiveWatchEnabled(guildId, youtubeChannelId, intent === "on")
      if (!updated) return { error: "That channel is not on this server's list.", saved: false }
      if (intent === "on") {
        const redis = await connectRedis()
        await redis.publish(LIVE_REFRESH_CHANNEL, `${guildId} ${youtubeChannelId}`)
      }
    } else {
      return { error: "That change is not valid", saved: false }
    }
  } catch (error) {
    console.error(error)
    return { error: "The list could not be changed", saved: false }
  }

  return done()
}

export async function setCommandEnabled(
  _state: PrefixActionState,
  formData: FormData,
): Promise<PrefixActionState> {
  const guildId = String(formData.get("guildId") ?? "")
  const name = String(formData.get("command") ?? "")
  const enabled = String(formData.get("enabled") ?? "")
  const ready = await prepare(guildId)
  if (!ready.ok) return { error: ready.error, saved: false }
  if (!isToggleableCommand(name) || (enabled !== "0" && enabled !== "1")) {
    return { error: "That command cannot be changed", saved: false }
  }

  try {
    const guild = await getGuild(guildId)
    if (!guild) return { error: "Iris is not in this server", saved: false }
    const next = new Set(sanitizeDisabledCommands(guild.disabledCommands ?? []))
    if (enabled === "1") next.delete(name)
    else next.add(name)
    const names = [...next]
    const updated = await setDisabledCommands(guildId, names)
    if (!updated) return { error: "Iris is not in this server", saved: false }
    const redis = await connectRedis()
    await redis.set(guildCommandsKey(guildId), JSON.stringify(names))
    await redis.publish(COMMANDS_CHANNEL, guildId)
  } catch (error) {
    console.error(error)
    return { error: "The command could not be changed", saved: false }
  }

  return done()
}
