import {
  getGuild,
  listGuildLiveWatches,
  listGuildsByIds,
  listLiveWatches,
  removeLiveWatch,
  saveLiveWatch,
  setGuildLiveChannel,
  setLiveVideo,
  upsertGuild,
  type LiveWatch,
} from "@iris/db"
import { canManageGuild, isSnowflake, LIVE_REFRESH_CHANNEL, LIVE_WATCH_LIMIT, parseChannelTarget } from "@iris/shared"
import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChannelSelectMenuInteraction,
  type Client,
  type GuildBasedChannel,
  type Message,
  type PermissionsBitField,
} from "discord.js"
import type { Redis } from "ioredis"
import type { BotEnv } from "./env"
import { readRemoteLives, resolveRemoteChannel, type RemoteLive } from "./player-client"
import { deliver, present, reply, safe, scene, warn, type Note } from "./reply"

const POLL_MS = 120_000
const CHUNK = 50
const PICK_MS = 10 * 60_000
export const LIVE_PICK_ID = "iris:live:pick"

type PendingWatch = {
  guildId: string
  youtubeId?: string
  youtubeName?: string
  at: number
}

const pending = new Map<string, PendingWatch>()
const picking = new Set<string>()
let checking = false

export function startLiveWatch(
  client: Client,
  env: BotEnv,
  redis: Redis,
): { close: () => Promise<void> } {
  const timer = setInterval(() => {
    void checkLives(client, env)
  }, POLL_MS)
  const subscriber = redis.duplicate()
  subscriber.on("error", (error: unknown) => {
    console.error("Live refresh subscriber error", error)
  })
  void (async () => {
    try {
      if (subscriber.status === "wait") await subscriber.connect()
      await subscriber.subscribe(LIVE_REFRESH_CHANNEL)
    } catch (error) {
      console.error("Live refresh subscribe failed", error)
    }
  })()
  subscriber.on("message", (channel, body) => {
    if (channel !== LIVE_REFRESH_CHANNEL) return
    const [guildId, youtubeChannelId] = body.split(" ")
    if (!guildId || !youtubeChannelId) return
    void announceOne(client, env, guildId, youtubeChannelId)
  })
  return {
    close: async () => {
      clearInterval(timer)
      if (subscriber.status !== "end") await subscriber.quit()
    },
  }
}

export async function runLiveCommand(message: Message, args: string[], env: BotEnv): Promise<void> {
  const guild = message.guild
  if (!guild || !message.channel.isTextBased() || message.channel.isDMBased()) {
    await reply(message, warn("Use a server", "Live alerts are posted in a server channel."))
    return
  }
  if (!manages(guild.ownerId, message.author.id, message.member?.permissions ?? null)) {
    await reply(
      message,
      warn("Manage Server needed", "Only the server owner, or a member with Manage Server, can change live alerts."),
    )
    return
  }

  const action = args[0]?.toLowerCase()
  if (!action || action === "channel" || action === "saluran") {
    await showPicker(message, null)
    return
  }
  if (action === "list" || action === "daftar") {
    await reply(message, await listNote(message))
    return
  }
  if (action === "remove" || action === "hapus" || action === "off") {
    await reply(message, await removeNote(guild.id, args.slice(1).join(" ").trim(), env))
    return
  }
  await addWatch(message, args.join(" ").trim(), env)
}

async function addWatch(message: Message, raw: string, env: BotEnv): Promise<void> {
  const guild = message.guild
  if (!guild) return
  const target = parseChannelTarget(raw)
  if (!target) {
    await reply(message, warn("Unknown channel", "Send a YouTube channel link or an @handle."))
    return
  }

  const found = await resolveRemoteChannel(env, target)
  if (!found.ok) {
    await reply(message, warn("YouTube", found.error))
    return
  }

  await upsertGuild(guild.id, guild.name)
  const destination = (await getGuild(guild.id))?.liveChannelId
  if (!destination) {
    await showPicker(message, { id: found.channel.id, name: found.channel.name })
    return
  }

  const saved = await rememberWatch(guild.id, destination, found.channel.id, found.channel.name)
  if (saved === "full") {
    await reply(message, warn("Live list is full", `This server can watch ${LIVE_WATCH_LIMIT} channels.`))
    return
  }
  if (saved === "created") {
    void announceIfLive(message.client, env, destination, guild.id, found.channel.id, found.channel.name)
  }
  const where = channelLabel(guild.channels.cache.get(destination))
  await reply(
    message,
    scene(
      "🔴 Live alerts",
      safe(found.channel.name),
      saved === "created"
        ? `-# This server's alerts go to ${where}. Iris checks YouTube every two minutes.`
        : `-# This YouTube channel is already watched for this server. Alerts go to ${where}.`,
    ),
  )
}

async function showPicker(
  message: Message,
  youtube: { id: string; name: string } | null,
): Promise<void> {
  const guild = message.guild
  if (!guild) return
  await upsertGuild(guild.id, guild.name)
  const current = (await getGuild(guild.id))?.liveChannelId ?? undefined
  const sent = await reply(message, {
    ...scene(
      "🔴 Live alerts",
      "Choose a channel",
      [
        "This menu is for this server only.",
        youtube ? `**${safe(youtube.name)}** is added after you choose.` : "Alerts are posted only in the channel you choose.",
        "-# Other servers keep their own list and their own channel.",
      ].join("\n"),
    ),
    channelPick: { customId: LIVE_PICK_ID, placeholder: "Choose a channel", channelId: current },
  })
  pending.set(sent.id, {
    guildId: guild.id,
    youtubeId: youtube?.id,
    youtubeName: youtube?.name,
    at: Date.now(),
  })
  if (pending.size > 200) {
    const oldest = [...pending.entries()].sort((left, right) => left[1].at - right[1].at)[0]
    if (oldest) pending.delete(oldest[0])
  }
}

export async function chooseLiveChannel(interaction: ChannelSelectMenuInteraction, env: BotEnv): Promise<void> {
  const messageId = interaction.message.id
  if (!interaction.guild || picking.has(messageId)) {
    await interaction.deferUpdate()
    return
  }
  picking.add(messageId)
  try {
    if (!manages(interaction.guild.ownerId, interaction.user.id, memberPermissions(interaction))) {
      await interaction.reply(ephemeral(interaction.message, warn(
        "Manage Server needed",
        "Only the server owner, or a member with Manage Server, can change live alerts.",
      )))
      return
    }

    const selected = await selectedTextChannel(interaction)
    if (!selected.ok) {
      await interaction.reply(ephemeral(interaction.message, warn("Choose another channel", selected.reason)))
      return
    }

    const guildId = interaction.guild.id
    await upsertGuild(guildId, interaction.guild.name)
    await setGuildLiveChannel(guildId, selected.channel.id)

    const waiting = takePending(messageId, guildId)
    let saved: "created" | "same" | "full" | "none" = "none"
    if (waiting.watch?.youtubeId && waiting.watch.youtubeName) {
      saved = await rememberWatch(guildId, selected.channel.id, waiting.watch.youtubeId, waiting.watch.youtubeName)
    }

    const where = channelLabel(selected.channel)
    const detail =
      saved === "full"
        ? `Alerts for this server go to ${where}.\n-# The list is full, so the YouTube channel was not added.`
        : saved === "created"
          ? `Alerts for this server go to ${where}.\n-# **${safe(waiting.watch?.youtubeName ?? "")}** was added.`
          : saved === "same"
            ? `Alerts for this server go to ${where}.\n-# **${safe(waiting.watch?.youtubeName ?? "")}** is already on this server's list.`
            : waiting.expired
              ? `Alerts for this server go to ${where}.\n-# The menu expired, so send the YouTube channel again.`
              : `Alerts for this server go to ${where}.`
    const savedNote = scene("🔴 Live alerts", "Channel saved", detail)
    await interaction.update({
      flags: MessageFlags.IsComponentsV2,
      components: present(interaction.message, savedNote).components,
      allowedMentions: { parse: [], repliedUser: false },
    })

    if (saved === "created" && waiting.watch?.youtubeId && waiting.watch.youtubeName) {
      void announceIfLive(
        interaction.client,
        env,
        selected.channel.id,
        guildId,
        waiting.watch.youtubeId,
        waiting.watch.youtubeName,
      )
    }
  } finally {
    picking.delete(messageId)
  }
}

async function listNote(message: Message): Promise<Note> {
  const guild = message.guild
  if (!guild) return warn("Use a server", "Live alerts are posted in a server channel.")
  const destination = (await getGuild(guild.id))?.liveChannelId
  const where = destination ? channelLabel(guild.channels.cache.get(destination)) : "not chosen yet"
  const watches = await listGuildLiveWatches(guild.id)
  if (watches.length === 0) {
    return scene(
      "🔴 Live alerts",
      "No channels yet",
      `-# Alerts for this server go to ${where}. Send a YouTube channel link or an @handle.`,
    )
  }
  const lines = watches.map((watch, index) => {
    const order = String(index + 1).padStart(2, "0")
    return `\`${order}\`  ${safe(watch.name)}${watch.enabled ? "" : " · off"}`
  })
  const label = watches.length === 1 ? "1 channel" : `${watches.length} channels`
  return scene(
    "🔴 Live alerts",
    label,
    `${lines.join("\n")}\n-# Alerts for this server go to ${where}. Other servers are separate.`,
  )
}

async function rememberWatch(
  guildId: string,
  discordChannelId: string,
  youtubeChannelId: string,
  name: string,
): Promise<"created" | "same" | "full"> {
  const watches = await listGuildLiveWatches(guildId)
  const exists = watches.some((watch) => watch.youtubeChannelId === youtubeChannelId)
  if (!exists && watches.length >= LIVE_WATCH_LIMIT) return "full"
  const saved = await saveLiveWatch(guildId, discordChannelId, youtubeChannelId, name)
  if (saved === "full") return "full"
  return saved === "created" ? "created" : "same"
}

function takePending(messageId: string, guildId: string): { watch: PendingWatch | null; expired: boolean } {
  const waiting = pending.get(messageId)
  pending.delete(messageId)
  if (!waiting || waiting.guildId !== guildId) return { watch: null, expired: false }
  if (Date.now() - waiting.at > PICK_MS) return { watch: null, expired: Boolean(waiting.youtubeId) }
  return { watch: waiting, expired: false }
}

export function channelLabel(channel: { name?: string } | null | undefined): string {
  return channel?.name ? `#${safe(channel.name)}` : "the chosen channel"
}

export function memberPermissions(
  interaction: ChannelSelectMenuInteraction,
): PermissionsBitField | string | null {
  const member = interaction.member
  if (!member || !("permissions" in member)) return null
  return member.permissions
}

export function manages(ownerId: string, userId: string, permissions: PermissionsBitField | string | null): boolean {
  if (userId === ownerId) return true
  if (!permissions) return false
  if (typeof permissions === "string") return canManageGuild(permissions, false)
  return canManageGuild(permissions.bitfield.toString(), false)
}

export async function selectedTextChannel(
  interaction: ChannelSelectMenuInteraction,
): Promise<{ ok: true; channel: GuildBasedChannel } | { ok: false; reason: string }> {
  const channelId = interaction.values[0]
  if (!interaction.guild || !channelId || !isSnowflake(channelId)) {
    return { ok: false, reason: "Choose a text channel in this server." }
  }
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null)
  if (!channel || channel.guildId !== interaction.guildId) {
    return { ok: false, reason: "Choose a text channel in this server." }
  }
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return { ok: false, reason: "Choose a text channel or an announcement channel." }
  }
  const me = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe())
  const permissions = me ? channel.permissionsFor(me) : null
  if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
    return { ok: false, reason: "Iris needs View Channel and Send Messages there." }
  }
  return { ok: true, channel }
}

export function ephemeral(message: Message, item: Note) {
  return {
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: present(message, item).components,
    allowedMentions: { parse: [] as const, repliedUser: false },
  }
}

async function removeNote(guildId: string, raw: string, env: BotEnv): Promise<Note> {
  if (!raw) return warn("Unknown channel", "Send the channel name, link, or @handle to remove.")
  const target = parseChannelTarget(raw)
  if (target?.type === "id") return removed(await removeLiveWatch(guildId, target.id))
  if (target) {
    const found = await resolveRemoteChannel(env, target)
    if (!found.ok) return warn("YouTube", found.error)
    return removed(await removeLiveWatch(guildId, found.channel.id))
  }
  if (/youtube\.com|youtu\.be|:\/\//i.test(raw)) {
    return warn("Unknown channel", "Send a YouTube channel link or an @handle.")
  }

  const wanted = raw.toLowerCase()
  const matches = (await listGuildLiveWatches(guildId)).filter((watch) => watch.name.toLowerCase() === wanted)
  if (matches.length > 1) return warn("Several matches", "Send the channel link so Iris removes the right one.")
  const match = matches[0]
  if (!match) return warn("Not on the list", "That channel is not being announced.")
  return removed(await removeLiveWatch(guildId, match.youtubeChannelId))
}

function removed(watch: LiveWatch | null): Note {
  if (!watch) return warn("Not on the list", "That channel is not being announced.")
  return scene("🔴 Live alerts", safe(watch.name), "-# Alerts for this channel are off.")
}

async function announceIfLive(
  client: Client,
  env: BotEnv,
  discordChannelId: string,
  guildId: string,
  channelId: string,
  name: string,
): Promise<void> {
  try {
    const read = await readRemoteLives(env, [channelId])
    const row = read.ok ? read.channels.find((item) => item.id === channelId) : undefined
    if (!row?.live || row.error) return
    const current = (await listGuildLiveWatches(guildId)).find((watch) => watch.youtubeChannelId === channelId)
    if (!current || current.liveVideoId === row.live.videoId) return
    const sent = await sendLive(client, discordChannelId, name, row.live)
    if (sent) await setLiveVideo(guildId, channelId, row.live.videoId)
  } catch (error) {
    console.error("Could not announce the current live stream", error)
  }
}

export async function checkLives(client: Client, env: BotEnv): Promise<void> {
  if (checking || !client.isReady()) return
  checking = true
  try {
    const watches = (await listLiveWatches()).filter((watch) => watch.enabled)
    const ids = [...new Set(watches.map((watch) => watch.youtubeChannelId))]
    if (ids.length === 0) return
    const servers = await listGuildsByIds([...new Set(watches.map((watch) => watch.guildId))])
    const destinations = new Map(servers.map((server) => [server.id, server.liveChannelId]))

    const statuses = new Map<string, RemoteLive>()
    for (let index = 0; index < ids.length; index += CHUNK) {
      const read = await readRemoteLives(env, ids.slice(index, index + CHUNK))
      if (!read.ok) {
        console.error("Live check stopped", read.error)
        return
      }
      for (const row of read.channels) statuses.set(row.id, row)
    }

    for (const watch of watches) {
      const status = statuses.get(watch.youtubeChannelId)
      if (!status || status.error) continue
      const channelId = destinations.get(watch.guildId)
      if (!channelId) continue
      if (status.live) {
        if (status.live.videoId === watch.liveVideoId) continue
        const sent = await sendLive(client, channelId, watch.name, status.live)
        if (sent) await setLiveVideo(watch.guildId, watch.youtubeChannelId, status.live.videoId)
        continue
      }
      if (watch.liveVideoId) await setLiveVideo(watch.guildId, watch.youtubeChannelId, null)
    }
  } catch (error) {
    console.error("Live check failed", error)
  } finally {
    checking = false
  }
}

async function announceOne(client: Client, env: BotEnv, guildId: string, youtubeChannelId: string): Promise<void> {
  if (!isSnowflake(guildId) || !/^UC[\w-]{22}$/.test(youtubeChannelId)) return
  const destination = (await getGuild(guildId))?.liveChannelId
  if (!destination) return
  const watch = (await listGuildLiveWatches(guildId)).find((item) => item.youtubeChannelId === youtubeChannelId)
  if (!watch?.enabled) return
  await announceIfLive(client, env, destination, guildId, watch.youtubeChannelId, watch.name)
}

async function sendLive(
  client: Client,
  channelId: string | null,
  name: string,
  live: { videoId: string; title: string },
): Promise<boolean> {
  if (!channelId) return false
  try {
    const channel = client.channels.cache.get(channelId) ?? (await client.channels.fetch(channelId))
    if (!channel?.isSendable()) return false
    if (!/^[A-Za-z0-9_-]{11}$/.test(live.videoId)) return false
    const watchUrl = `https://www.youtube.com/watch?v=${live.videoId}`
    await channel.send(deliver(client, scene("🔴 Live", safe(name), `${safe(live.title)}\n${watchUrl}`)))
    await channel.send({ content: watchUrl, allowedMentions: { parse: [] } })
    return true
  } catch (error) {
    console.error(`Could not announce a live stream in ${channelId}`, error)
    return false
  }
}
