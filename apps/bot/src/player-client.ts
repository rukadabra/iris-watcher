import type { ChannelTarget, YoutubeItem } from "@iris/shared"
import { Readable } from "node:stream"

export type RemoteTrack = {
  id: string
  title: string
}

type PlayerConfig = {
  PLAYER_URL?: string
  PLAYER_TOKEN?: string
}

export async function resolveRemoteTracks(
  config: PlayerConfig,
  items: YoutubeItem[],
  radio: boolean,
): Promise<{ ok: true; tracks: RemoteTrack[] } | { ok: false; error: string }> {
  const ready = playerTarget(config)
  if (!ready.ok) return ready

  try {
    const response = await fetch(`${ready.base}/resolve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ready.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items, radio }),
      signal: AbortSignal.timeout(50_000),
    })
    const body = (await response.json()) as { tracks?: RemoteTrack[]; error?: string }
    if (!response.ok) return { ok: false, error: body.error || "The music service rejected the request." }
    const tracks = (body.tracks ?? []).filter((track) => track.id && track.title)
    if (tracks.length === 0) return { ok: false, error: "YouTube did not return a song." }
    return { ok: true, tracks }
  } catch {
    return { ok: false, error: "The music service at home is not running." }
  }
}

export async function searchRemoteTrack(
  config: PlayerConfig,
  query: string,
): Promise<{ ok: true; track: RemoteTrack } | { ok: false; error: string }> {
  const ready = playerTarget(config)
  if (!ready.ok) return ready

  try {
    const response = await fetch(`${ready.base}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ready.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(50_000),
    })
    const body = (await response.json()) as { track?: RemoteTrack; error?: string }
    if (!response.ok || !body.track?.id || !body.track.title) {
      return { ok: false, error: body.error || "YouTube could not find that song." }
    }
    return { ok: true, track: body.track }
  } catch {
    return { ok: false, error: "The music service at home is not running." }
  }
}

export type RemoteChannel = {
  id: string
  name: string
}

export type RemoteLive = {
  id: string
  live: { videoId: string; title: string } | null
  error?: boolean
}

export async function resolveRemoteChannel(
  config: PlayerConfig,
  target: ChannelTarget,
): Promise<{ ok: true; channel: RemoteChannel } | { ok: false; error: string }> {
  const ready = playerTarget(config)
  if (!ready.ok) return ready

  try {
    const response = await fetch(`${ready.base}/channel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ready.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(target),
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await response.json()) as { channel?: RemoteChannel; error?: string }
    if (!response.ok || !body.channel?.id || !body.channel.name) {
      return { ok: false, error: body.error || "YouTube could not find that channel." }
    }
    return { ok: true, channel: body.channel }
  } catch {
    return { ok: false, error: "The music service at home is not running." }
  }
}

export async function readRemoteLives(
  config: PlayerConfig,
  ids: string[],
): Promise<{ ok: true; channels: RemoteLive[] } | { ok: false; error: string }> {
  const ready = playerTarget(config)
  if (!ready.ok) return ready

  try {
    const response = await fetch(`${ready.base}/live`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ready.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(150_000),
    })
    const body = (await response.json()) as { channels?: RemoteLive[]; error?: string }
    if (!response.ok || !body.channels) {
      return { ok: false, error: body.error || "The music service rejected the request." }
    }
    return { ok: true, channels: body.channels }
  } catch {
    return { ok: false, error: "The music service at home is not running." }
  }
}

export async function openRemoteAudio(config: PlayerConfig, videoId: string, signal: AbortSignal): Promise<Readable> {
  const ready = playerTarget(config)
  if (!ready.ok) throw new Error(ready.error)

  const response = await fetch(`${ready.base}/stream/${videoId}`, {
    headers: { Authorization: `Bearer ${ready.token}` },
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(`Audio ${videoId} was rejected`)
  }
  return Readable.fromWeb(response.body)
}

function playerTarget(
  config: PlayerConfig,
): { ok: true; base: string; token: string } | { ok: false; error: string } {
  if (!config.PLAYER_URL || !config.PLAYER_TOKEN) {
    return { ok: false, error: "The YouTube service at home is not connected." }
  }
  return { ok: true, base: config.PLAYER_URL.replace(/\/$/, ""), token: config.PLAYER_TOKEN }
}
