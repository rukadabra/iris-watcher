import type { ChannelTarget } from "@iris/shared"

export type ResolvedChannel = {
  id: string
  name: string
}

export async function resolveYoutubeChannel(
  target: ChannelTarget,
): Promise<{ ok: true; channel: ResolvedChannel } | { ok: false; error: string }> {
  const base = process.env.PLAYER_URL?.replace(/\/$/, "")
  const token = process.env.PLAYER_TOKEN
  if (!base || !token || token.length < 16) {
    return { ok: false, error: "The YouTube service at home is not connected." }
  }

  try {
    const response = await fetch(`${base}/channel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(target),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    })
    const body = (await response.json()) as { channel?: ResolvedChannel; error?: string }
    if (!response.ok || !body.channel?.id || !body.channel.name) {
      return { ok: false, error: body.error || "YouTube could not find that channel." }
    }
    return { ok: true, channel: { id: body.channel.id, name: body.channel.name } }
  } catch {
    return { ok: false, error: "The YouTube service at home is not running." }
  }
}
