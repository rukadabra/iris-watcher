const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const PLAYLIST_ID = /^[A-Za-z0-9_-]{12,64}$/

export type YoutubeItem =
  | { type: "video"; id: string }
  | { type: "playlist"; id: string }

export type PlayRequest =
  | { kind: "search"; fresh: boolean; query: string }
  | { kind: "youtube"; fresh: boolean; items: YoutubeItem[] }

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"])

export function classifyPlayArgs(args: readonly string[]): PlayRequest {
  const freshWord = args[0]?.toLowerCase()
  const fresh = freshWord === "new"
  const source = fresh ? args.slice(1) : args
  const items: YoutubeItem[] = []

  for (const part of source) {
    const item = parseYoutubeTarget(part)
    if (item) items.push(item)
  }

  if (items.length === 0) {
    return { kind: "search", fresh, query: source.join(" ").trim() }
  }
  return { kind: "youtube", fresh, items }
}

export function parseYoutubeTarget(raw: string): YoutubeItem | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (!YOUTUBE_HOSTS.has(host)) return null

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    return id && VIDEO_ID.test(id) ? { type: "video", id } : null
  }

  const list = url.searchParams.get("list")
  const savedList = list && !list.startsWith("RD") && PLAYLIST_ID.test(list) ? list : null
  if (url.pathname === "/playlist" || url.pathname.startsWith("/playlist/")) {
    return savedList ? { type: "playlist", id: savedList } : null
  }

  const shorts = /^\/shorts\/([A-Za-z0-9_-]{11})/.exec(url.pathname)
  if (shorts?.[1]) return { type: "video", id: shorts[1] }

  const video = url.searchParams.get("v")
  if (video && VIDEO_ID.test(video)) return { type: "video", id: video }
  if (savedList) return { type: "playlist", id: savedList }
  return null
}
