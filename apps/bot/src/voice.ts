import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type AudioResource,
  type VoiceConnection,
} from "@discordjs/voice"
import type { YoutubeItem } from "@iris/shared"
import { ChannelType, PermissionFlagsBits, type Message, type VoiceChannel } from "discord.js"
import { openRemoteAudio, resolveRemoteTracks, type RemoteTrack } from "./player-client"
import { showPresence } from "./presence"
import { note, present, safe, scene, warn, type Note } from "./reply"

const RADIO_LIMIT = 40
const PAGE_SIZE = 8
const ALONE_MS = 60_000
const VOLUME_MIN = 0
const VOLUME_MAX = 200
const VOLUME_STEP = 10

type LoopMode = "off" | "one" | "all"

type Track = {
  title: string
  videoId: string
}

type PlayerConfig = {
  PLAYER_URL?: string
  PLAYER_TOKEN?: string
}

type Session = {
  connection: VoiceConnection
  player: AudioPlayer
  queue: Track[]
  current: Track | null
  stopped: boolean
  interrupt: boolean
  advancing: boolean
  abort: AbortController | null
  radioFrom: string | null
  seen: Set<string>
  radioAdded: number
  prefetching: boolean
  config: PlayerConfig | null
  tell: ((item: Note) => void) | null
  channel: VoiceChannel
  alone: ReturnType<typeof setTimeout> | null
  queuePage: number
  loop: LoopMode
  played: Track[]
  skipRequested: boolean
  openedQuietly: string | null
  heardAt: number
  volume: number
  resource: AudioResource | null
}

const sessions = new Map<string, Session>()

async function playNext(session: Session): Promise<void> {
  if (session.advancing) {
    session.interrupt = true
    session.abort?.abort()
    return
  }

  session.advancing = true
  let fails = 0
  try {
    while (!session.stopped && fails < 3) {
      session.interrupt = false
      const previousId = session.current?.videoId ?? null
      const picked = takeQueued(session)
      const next = picked === "radio" ? await pullRadio(session) : picked
      if (!next || session.stopped) {
        session.current = null
        syncPresence()
        return
      }
      session.current = next
      if (next.videoId) session.seen.add(next.videoId)
      try {
        await startCurrent(session, next)
        if (session.stopped) return
        if (session.interrupt) continue
        if (session.loop === "off") void prefetch(session)
        session.heardAt = Date.now()
        syncPresence()
        announceTrack(session, next, previousId)
        return
      } catch (error) {
        if (session.stopped) return
        if (session.interrupt) continue
        console.error("Could not open the song", error)
        fails += 1
      }
    }
    session.tell?.(warn("Playback stopped", "Several songs failed to open."))
    session.current = null
    syncPresence()
  } finally {
    session.advancing = false
    if (session.interrupt && !session.stopped) {
      session.interrupt = false
      void playNext(session)
    }
  }
}

function takeQueued(session: Session): Track | null | "radio" {
  const skipping = session.skipRequested
  session.skipRequested = false
  if (session.loop === "one" && session.current && !skipping) return session.current

  if (session.current && session.loop === "all") session.played.push(session.current)
  const queued = session.queue.shift()
  if (queued) return queued
  if (session.loop === "all" && session.played.length > 0) {
    session.queue = session.played
    session.played = []
    return session.queue.shift() ?? null
  }
  if (session.loop === "all") return null
  return "radio"
}

function announceTrack(session: Session, track: Track, previousId: string | null): void {
  const quiet = session.openedQuietly === track.videoId
  session.openedQuietly = null
  if (quiet || previousId === track.videoId || !session.current) return
  session.queuePage = 1
  session.tell?.(playingNote(session, "🎵 Now playing"))
}

async function startCurrent(session: Session, track: Track): Promise<void> {
  session.abort?.abort()
  if (!session.config) throw new Error("The YouTube song is incomplete")

  const abort = new AbortController()
  session.abort = abort
  const stream = await openRemoteAudio(session.config, track.videoId, abort.signal)
  if (abort.signal.aborted || session.stopped) {
    stream.destroy()
    return
  }
  const resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true })
  session.resource = resource
  resource.volume?.setVolume(session.volume / 100)
  session.player.play(resource)
}

async function pullRadio(session: Session): Promise<Track | null> {
  if (!session.radioFrom || !session.config || session.radioAdded >= RADIO_LIMIT) return null
  const seed = session.current?.videoId ?? session.radioFrom
  const more = await extendRadio(session.config, seed, session.seen, session.queue)
  session.radioAdded += more.length
  const next = more[0]
  if (!next) return null
  session.queue.push(...more.slice(1))
  return next
}

async function prefetch(session: Session): Promise<void> {
  if (
    session.prefetching ||
    !session.radioFrom ||
    !session.config ||
    session.queue.length >= 3 ||
    session.radioAdded >= RADIO_LIMIT
  ) {
    return
  }
  session.prefetching = true
  try {
    const seed = session.queue.at(-1)?.videoId ?? session.current?.videoId ?? session.radioFrom
    const more = await extendRadio(session.config, seed, session.seen, session.queue)
    session.queue.push(...more)
    session.radioAdded += more.length
  } catch (error) {
    console.error("Could not read the YouTube continuation", error)
  } finally {
    session.prefetching = false
  }
}

async function extendRadio(
  config: PlayerConfig,
  videoId: string,
  seen: Set<string>,
  queued: Track[],
): Promise<Track[]> {
  const resolved = await resolveRemoteTracks(config, [{ type: "video", id: videoId }], true)
  if (!resolved.ok) return []
  const queuedIds = new Set(queued.map((track) => track.videoId))
  return resolved.tracks
    .filter((track) => !seen.has(track.id) && !queuedIds.has(track.id))
    .map(remoteTrack)
}

function controlsFor(session: Session): Note["controls"] {
  const pages = Math.max(1, Math.ceil(session.queue.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, session.queuePage), pages)
  const status = session.player.state.status
  return {
    paused: status === AudioPlayerStatus.Paused || status === AudioPlayerStatus.AutoPaused,
    page,
    pages,
    loop: session.loop,
    volume: session.volume,
  }
}

function syncPresence(): void {
  let chosen: { title: string; paused: boolean; heardAt: number } | null = null
  for (const session of sessions.values()) {
    if (!session.current) continue
    const status = session.player.state.status
    const paused = status === AudioPlayerStatus.Paused || status === AudioPlayerStatus.AutoPaused
    const candidate = { title: session.current.title, paused, heardAt: session.heardAt }
    if (!chosen || (chosen.paused && !candidate.paused) || (chosen.paused === candidate.paused && candidate.heardAt >= chosen.heardAt)) {
      chosen = candidate
    }
  }
  showPresence(chosen ? { title: chosen.title, paused: chosen.paused } : null)
}

function shown(session: Session, item: Note): Note {
  if (!session.current && session.queue.length === 0) return item
  const volume = `-# Volume ${session.volume}%.`
  const description = item.description ? `${item.description}\n${volume}` : volume
  return { ...item, description, controls: controlsFor(session) }
}

export function attachControls(guildId: string, item: Note): Note {
  const session = sessions.get(guildId)
  if (!session) return item
  return shown(session, item)
}

export function botVoiceChannel(guildId: string): string | null {
  const session = sessions.get(guildId)
  if (!session || session.connection.state.status === VoiceConnectionStatus.Destroyed) return null
  return session.connection.joinConfig.channelId
}

function remoteTrack(track: RemoteTrack): Track {
  return { title: track.title, videoId: track.id }
}

function leaveGuild(guildId: string): void {
  const session = sessions.get(guildId)
  if (!session) return
  sessions.delete(guildId)
  clearAlone(session)
  session.stopped = true
  session.queue = []
  session.abort?.abort()
  session.player.stop(true)
  if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    session.connection.destroy()
  }
  syncPresence()
}

function clearAlone(session: Session): void {
  if (!session.alone) return
  clearTimeout(session.alone)
  session.alone = null
}

function hasCompany(session: Session): boolean {
  const channelId = session.connection.joinConfig.channelId
  const botId = session.channel.client.user?.id
  if (!channelId || !botId) return true
  for (const state of session.channel.guild.voiceStates.cache.values()) {
    if (state.channelId !== channelId || state.id === botId) continue
    if (state.member?.user.bot) continue
    return true
  }
  return false
}

function scheduleAlone(session: Session): void {
  if (hasCompany(session)) {
    clearAlone(session)
    return
  }
  if (session.alone) return
  const guildId = session.channel.guild.id
  session.alone = setTimeout(() => {
    session.alone = null
    if (sessions.get(guildId) !== session || hasCompany(session)) return
    session.tell?.(note("👋 Left", "-# The voice channel was empty for one minute."))
    leaveGuild(guildId)
  }, ALONE_MS)
}

export function watchAlone(guildId: string): void {
  const session = sessions.get(guildId)
  if (!session || session.connection.state.status === VoiceConnectionStatus.Destroyed) return
  const channelId = session.connection.joinConfig.channelId
  if (channelId && session.channel.id !== channelId) {
    const next = session.channel.guild.channels.cache.get(channelId)
    if (next?.type === ChannelType.GuildVoice) session.channel = next
  }
  scheduleAlone(session)
}

async function recoverOrLeave(session: Session, guildId: string): Promise<void> {
  if (sessions.get(guildId) !== session) return
  try {
    await Promise.race([
      entersState(session.connection, VoiceConnectionStatus.Signalling, 5_000),
      entersState(session.connection, VoiceConnectionStatus.Connecting, 5_000),
    ])
  } catch {
    if (sessions.get(guildId) === session) leaveGuild(guildId)
  }
}

function ensureSession(channel: VoiceChannel): Session {
  const existing = sessions.get(channel.guild.id)
  if (existing && existing.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    if (existing.connection.joinConfig.channelId !== channel.id) {
      existing.channel = channel
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      })
      scheduleAlone(existing)
    }
    return existing
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
  })
  const player = createAudioPlayer()
  connection.subscribe(player)
  const session: Session = {
    connection,
    player,
    queue: [],
    current: null,
    stopped: false,
    interrupt: false,
    advancing: false,
    abort: null,
    radioFrom: null,
    seen: new Set(),
    radioAdded: 0,
    prefetching: false,
    config: null,
    tell: null,
    channel,
    alone: null,
    queuePage: 1,
    loop: "off",
    played: [],
    skipRequested: false,
    openedQuietly: null,
    heardAt: 0,
    volume: 100,
    resource: null,
  }
  sessions.set(channel.guild.id, session)

  player.on("error", (error) => {
    console.error(`Could not play in ${channel.guild.id}`, error)
  })
  player.on(AudioPlayerStatus.Idle, () => {
    if (session.stopped || session.advancing) return
    void playNext(session)
  })
  connection.on(VoiceConnectionStatus.Disconnected, () => {
    void recoverOrLeave(session, channel.guild.id)
  })
  scheduleAlone(session)

  return session
}

async function resolveVoiceChannel(
  message: Message,
): Promise<{ channel: VoiceChannel } | { error: Note }> {
  const guild = message.guild
  if (!guild) return { error: warn("Use a server", "This command works in a server, not in a direct message.") }

  const current = message.member?.voice.channel
  if (!current) return { error: warn("Join voice first", "Iris follows the channel you are in.") }
  if (current.type !== ChannelType.GuildVoice) {
    return { error: warn("Voice channel", "Iris plays in a regular voice channel.") }
  }

  const me = guild.members.me ?? (await guild.members.fetchMe())
  const permissions = current.permissionsFor(me)
  if (
    !permissions?.has(PermissionFlagsBits.Connect) ||
    !permissions.has(PermissionFlagsBits.Speak)
  ) {
    return {
      error: warn(
        "Permission needed",
        "Iris needs Connect and Speak in this channel. Open the invite link again, then authorize it.",
      ),
    }
  }

  return { channel: current }
}

async function connect(message: Message): Promise<{ session: Session; channel: VoiceChannel } | { error: Note }> {
  const resolved = await resolveVoiceChannel(message)
  if ("error" in resolved) return resolved
  const session = ensureSession(resolved.channel)
  try {
    await entersState(session.connection, VoiceConnectionStatus.Ready, 15_000)
  } catch {
    leaveGuild(resolved.channel.guild.id)
    return { error: warn("Voice did not connect", "Iris could not join that channel.") }
  }
  rememberChannel(session, message)
  scheduleAlone(session)
  return { session, channel: resolved.channel }
}

function rememberChannel(session: Session, message: Message): void {
  session.tell = (item) => {
    if (!message.channel.isSendable()) return
    void message.channel.send(present(message, item)).catch(() => {})
  }
}

export async function joinVoice(message: Message): Promise<Note> {
  const connected = await connect(message)
  if ("error" in connected) return connected.error
  return scene("🎧 Joined voice", safe(connected.channel.name), "-# Iris is in this channel.")
}

export async function playYoutube(
  message: Message,
  config: PlayerConfig,
  items: YoutubeItem[],
  fresh: boolean,
): Promise<Note> {
  const playing = message.guild ? sessions.get(message.guild.id) : undefined
  const starting = fresh || !playing?.current
  const radio = starting && items.length === 1 && items[0]?.type === "video"
  const resolved = await resolveRemoteTracks(config, items, radio)
  if (!resolved.ok) {
    const guildId = message.guild?.id ?? ""
    return attachControls(guildId, warn("YouTube", resolved.error))
  }

  const connected = await connect(message)
  if ("error" in connected) return connected.error
  const { session } = connected
  session.config = config
  rememberChannel(session, message)

  const tracks = resolved.tracks.map(remoteTrack)
  if (fresh || !session.current) {
    session.stopped = true
    session.abort?.abort()
    session.queue = []
    session.player.stop(true)
    session.stopped = false
    session.current = null
    session.played = []
    session.skipRequested = false
    session.seen = new Set(tracks.map((track) => track.videoId).filter((id): id is string => Boolean(id)))
    session.radioFrom = radio ? (items[0]?.type === "video" ? items[0].id : null) : null
    session.radioAdded = tracks.length
    session.queue = tracks
    session.queuePage = 1
    session.openedQuietly = tracks[0]?.videoId ?? null
    void playNext(session)
  } else {
    session.queue.push(...tracks)
  }

  session.queuePage = 1
  const now = safe(session.current?.title ?? tracks[0]?.title ?? "a song")
  const waiting = session.current ? session.queue : tracks.slice(1)
  const pages = Math.max(1, Math.ceil(waiting.length / PAGE_SIZE))
  const kicker = !fresh && playing?.current ? "➕ Added" : "🎵 Now playing"
  return shown(
    session,
    scene(kicker, now, playlistLines(waiting.slice(0, PAGE_SIZE), session.radioFrom !== null, session.loop, 1, pages)),
  )
}

function playingNote(session: Session, kicker: string): Note {
  const pages = Math.max(1, Math.ceil(session.queue.length / PAGE_SIZE))
  return shown(
    session,
    scene(
      kicker,
      safe(session.current?.title ?? "a song"),
      playlistLines(session.queue.slice(0, PAGE_SIZE), session.radioFrom !== null, session.loop, 1, pages),
    ),
  )
}

function loopKicker(loop: LoopMode): string {
  if (loop === "one") return "🔂 Loop one"
  if (loop === "all") return "🔁 Loop all"
  return "➡️ Loop off"
}

function applyLoop(session: Session, mode: LoopMode): Note {
  if (session.loop !== mode) session.played = []
  session.loop = mode
  return playingNote(session, loopKicker(mode))
}

export function loopStatus(guildId: string): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  return playingNote(session, loopKicker(session.loop))
}

export function setLoop(guildId: string, mode: LoopMode): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  return applyLoop(session, mode)
}

export function adjustVolume(guildId: string, direction: "up" | "down"): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  const delta = direction === "up" ? VOLUME_STEP : -VOLUME_STEP
  session.volume = Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, session.volume + delta))
  session.resource?.volume?.setVolume(session.volume / 100)
  return playingNote(session, direction === "up" ? "🔊 Volume" : "🔉 Volume")
}

export function toggleLoop(guildId: string, mode: "one" | "all"): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  return applyLoop(session, session.loop === mode ? "off" : mode)
}

export function describeQueue(guildId: string, requested: number | "next" | "prev" = 1): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  const pages = Math.max(1, Math.ceil(session.queue.length / PAGE_SIZE))
  let page = session.queuePage
  if (requested === "next") page += 1
  else if (requested === "prev") page -= 1
  else page = requested
  page = Math.min(Math.max(1, page), pages)
  session.queuePage = page

  const start = (page - 1) * PAGE_SIZE
  const paused = session.player.state.status === AudioPlayerStatus.Paused || session.player.state.status === AudioPlayerStatus.AutoPaused
  return shown(
    session,
    scene(
      paused ? "⏸️ Paused" : "🎶 Queue",
      safe(session.current.title),
      playlistLines(session.queue.slice(start, start + PAGE_SIZE), session.radioFrom !== null, session.loop, page, pages, start),
    ),
  )
}

function playlistLines(tracks: Track[], radio: boolean, loop: LoopMode = "off", page = 1, pages = 1, start = 0): string {
  const lines = tracks.slice(0, PAGE_SIZE).map((track, index) => {
    const order = String(start + index + 1).padStart(2, "0")
    return `\`${order}\`  ${safe(track.title)}`
  })
  return [
    pages > 1 ? `-# Page ${page} of ${pages}` : "",
    loop === "one" ? "-# This song repeats." : "",
    loop === "all" ? "-# The queue restarts after the last song." : "",
    loop === "off" && radio ? "-# YouTube will keep adding songs." : "",
    lines.length > 0 ? lines.join("\n") : "-# Nothing is queued next.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function pausePlayback(guildId: string): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  const status = session.player.state.status
  if (status === AudioPlayerStatus.Paused || status === AudioPlayerStatus.AutoPaused) {
    return shown(session, scene("⏸️ Paused", safe(session.current.title), "-# Playback is already paused."))
  }
  if (status !== AudioPlayerStatus.Playing || !session.player.pause(true)) {
    return warn("Cannot pause yet", "This song is not playing.")
  }
  syncPresence()
  return shown(session, scene("⏸️ Paused", safe(session.current.title), "-# Playback is paused."))
}

export function resumePlayback(guildId: string): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  const status = session.player.state.status
  if (status !== AudioPlayerStatus.Paused && status !== AudioPlayerStatus.AutoPaused) {
    return warn("Not paused", "Nothing is paused.")
  }
  session.player.unpause()
  session.heardAt = Date.now()
  syncPresence()
  return shown(session, scene("▶️ Resume", safe(session.current.title), "-# Playback continues."))
}

export function skipTrack(guildId: string): Note {
  const session = sessions.get(guildId)
  if (!session?.current) return warn("Queue is empty", "Nothing is playing.")
  const name = safe(session.current.title)
  session.skipRequested = true
  session.abort?.abort()
  if (session.player.state.status === AudioPlayerStatus.Idle) void playNext(session)
  else session.player.stop(true)
  return shown(session, scene("⏭️ Next", name, "-# This song was skipped."))
}

export function stopPlayback(guildId: string): Note {
  const session = sessions.get(guildId)
  if (!session || (!session.current && session.queue.length === 0)) {
    return warn("Already quiet", "Iris is not playing anything.")
  }
  session.stopped = true
  session.radioFrom = null
  session.loop = "off"
  session.played = []
  session.skipRequested = false
  session.openedQuietly = null
  session.queue = []
  session.current = null
  session.abort?.abort()
  session.player.stop(true)
  syncPresence()
  return note("⏹️ Stopped", "-# The queue is clear. Iris stays in the voice channel.")
}

export function leaveVoice(guildId: string): Note {
  if (!sessions.has(guildId)) return warn("Not in voice", "Iris is not in a voice channel.")
  leaveGuild(guildId)
  return note("👋 Left", "-# Iris left the voice channel.")
}

export function closeVoice(): void {
  for (const guildId of [...sessions.keys()]) leaveGuild(guildId)
}
