import { channelLiveUrl, channelPageUrl, type ChannelTarget } from "@iris/shared"

const VIDEO_ID = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/
const CHANNEL_CANONICAL = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})">/
const EXTERNAL_ID = /"externalId":"(UC[\w-]{22})"/
const OG_TITLE = /<meta property="og:title" content="([^"]*)"/

const headers = { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" }

export type LiveSnapshot = {
  videoId: string
  title: string
}

export type ChannelIdentity = {
  id: string
  name: string
}

export type LiveRead = {
  id: string
  live: LiveSnapshot | null
  error?: boolean
}

let tail: Promise<void> = Promise.resolve()

export function readLivePage(html: string): LiveSnapshot | null {
  const videoId = VIDEO_ID.exec(html)?.[1]
  if (!videoId) return null
  const details = new RegExp(
    `"videoDetails":\\{"videoId":"${videoId}","title":"((?:\\\\.|[^"\\\\])*)"`,
  ).exec(html)
  if (!details?.[1]) return null
  const nearby = html.slice(details.index, details.index + 500)
  if (!nearby.includes('"isLive":true')) return null
  return { videoId, title: decodeJsonString(details[1]) || pageTitle(html) || "Live" }
}

export function readChannelPage(html: string): ChannelIdentity | null {
  const id = CHANNEL_CANONICAL.exec(html)?.[1] ?? EXTERNAL_ID.exec(html)?.[1]
  if (!id) return null
  return { id, name: pageTitle(html) || "YouTube" }
}

export async function lookupChannel(target: ChannelTarget): Promise<ChannelIdentity | null> {
  const html = await fetchPage(channelPageUrl(target))
  return readChannelPage(html)
}

export async function readLives(ids: string[]): Promise<LiveRead[]> {
  const reads: LiveRead[] = []
  for (const id of ids) {
    try {
      const html = await oneLive(() => fetchPage(channelLiveUrl(id)))
      reads.push({ id, live: readLivePage(html) })
    } catch (error) {
      console.error(`Could not read live status for ${id}`, error)
      reads.push({ id, live: null, error: true })
    }
  }
  return reads
}

function pageTitle(html: string): string {
  const raw = OG_TITLE.exec(html)?.[1] ?? ""
  return decodeHtml(raw).replace(/ - YouTube$/, "").replace(/\s+/g, " ").trim().slice(0, 100)
}

function decodeJsonString(value: string): string {
  try {
    const parsed = JSON.parse(`"${value}"`) as unknown
    if (typeof parsed === "string") return parsed.replace(/\s+/g, " ").trim().slice(0, 100)
  } catch {
    return value.replace(/\s+/g, " ").trim().slice(0, 100)
  }
  return ""
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error(`YouTube responded ${response.status}`)
  return response.text()
}

function oneLive<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task)
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
