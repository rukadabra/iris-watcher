import type { YoutubeMeta } from "./metadata"

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

let innertube: { key: string; version: string } | null = null

export function readLockups(data: unknown): YoutubeMeta[] {
  const tracks: YoutubeMeta[] = []
  const seen = new Set<string>()
  walk(data, (id, title) => {
    if (!VIDEO_ID.test(id) || seen.has(id)) return
    seen.add(id)
    tracks.push({ id, title: title || id })
  })
  return tracks
}

export async function fetchRadio(videoId: string): Promise<YoutubeMeta[]> {
  const client = await loadInnertube()
  const response = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en",
    },
    body: JSON.stringify({
      context: {
        client: { clientName: "WEB", clientVersion: client.version, hl: "en", gl: "US" },
      },
      videoId,
      playlistId: `RD${videoId}`,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) return []
  return readLockups(await response.json())
}

async function loadInnertube(): Promise<{ key: string; version: string }> {
  if (innertube) return innertube
  const response = await fetch("https://www.youtube.com", {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" },
    signal: AbortSignal.timeout(20_000),
  })
  const html = await response.text()
  const key = /"INNERTUBE_API_KEY":"([^"]+)"/.exec(html)?.[1]
  const version = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1]
  if (!key || !version) throw new Error("Klien YouTube tidak terbaca")
  innertube = { key, version }
  return innertube
}

function walk(node: unknown, visit: (id: string, title: string) => void): void {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit)
    return
  }

  const record = node as Record<string, unknown>
  const model = record.lockupViewModel
  if (model && typeof model === "object") {
    const lockup = model as Record<string, unknown>
    const id = typeof lockup.contentId === "string" ? lockup.contentId : ""
    visit(id, lockupTitle(lockup.metadata))
  }

  for (const value of Object.values(record)) walk(value, visit)
}

function lockupTitle(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return ""
  const title = (metadata as { lockupMetadataViewModel?: { title?: unknown } }).lockupMetadataViewModel
    ?.title
  return textOf(title)
}

function textOf(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (typeof value !== "object") return ""
  const record = value as { simpleText?: unknown; content?: unknown; runs?: { text?: string }[] }
  if (typeof record.simpleText === "string") return record.simpleText
  if (Array.isArray(record.runs)) return record.runs.map((run) => run.text ?? "").join("")
  if (record.content) return textOf(record.content)
  return ""
}
