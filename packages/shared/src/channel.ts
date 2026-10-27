const CHANNEL_ID = /^UC[\w-]{22}$/
const HANDLE = /^[\p{L}\p{N}._-]{3,30}$/u
const SLUG = /^[\p{L}\p{N}._-]{1,80}$/u
const HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com"])

export const LIVE_WATCH_LIMIT = 50

export type ChannelTarget =
  | { type: "id"; id: string }
  | { type: "handle"; handle: string }
  | { type: "custom"; kind: "c" | "user"; name: string }

export function parseChannelTarget(raw: string): ChannelTarget | null {
  const text = raw.trim()
  if (!text || text.length > 200 || /[\u0000-\u001f]/.test(text)) return null
  if (text.startsWith("@")) return handleTarget(text.slice(1))

  let url: URL
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (!HOSTS.has(host)) return null

  const parts = url.pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part)
    } catch {
      return part
    }
  })
  const head = parts[0]
  if (!head) return null
  if (head === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) return { type: "id", id: parts[1] }
  if (head.startsWith("@")) return handleTarget(head.slice(1))
  if ((head === "c" || head === "user") && parts[1] && SLUG.test(parts[1])) {
    return { type: "custom", kind: head, name: parts[1] }
  }
  return null
}

export function channelPageUrl(target: ChannelTarget): string {
  if (target.type === "id") return `https://www.youtube.com/channel/${target.id}`
  if (target.type === "handle") return `https://www.youtube.com/@${encodeURIComponent(target.handle)}`
  return `https://www.youtube.com/${target.kind}/${encodeURIComponent(target.name)}`
}

export function channelLiveUrl(id: string): string {
  return `https://www.youtube.com/channel/${id}/live`
}

function handleTarget(handle: string): ChannelTarget | null {
  return HANDLE.test(handle) ? { type: "handle", handle } : null
}
