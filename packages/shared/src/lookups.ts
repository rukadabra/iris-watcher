const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => fromCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => fromCode(Number(digits)))
    .replace(/&([a-z]+);/gi, (all, name: string) => namedEntities[name.toLowerCase()] ?? all)
}

function fromCode(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return ""
  return String.fromCodePoint(code)
}

export function stripTags(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function readable(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .replace(/<@[!&]?\d+>/g, "")
    .replace(/^#/gm, "\\#")
    .trim()
    .slice(0, max)
}

export function lyricQuery(title: string): string {
  return title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}

export type LyricsHit = {
  title: string
  artist: string
  album: string
  duration: string
  lyrics: string
  instrumental: boolean
}

export function pickLyrics(payload: unknown): LyricsHit | null {
  if (!Array.isArray(payload)) return null
  const rows = payload.flatMap((item) => {
    const row = record(item)
    return row ? [row] : []
  })
  const chosen = rows.find((row) => text(row.plainLyrics) || text(row.syncedLyrics)) ?? rows.find((row) => row.instrumental === true)
  if (!chosen) return null
  const plain = text(chosen.plainLyrics)
  const synced = unsync(text(chosen.syncedLyrics))
  return {
    title: text(chosen.trackName) || text(chosen.name),
    artist: text(chosen.artistName),
    album: text(chosen.albumName),
    duration: typeof chosen.duration === "number" ? clock(chosen.duration) : "",
    lyrics: plain || synced,
    instrumental: chosen.instrumental === true && !plain && !synced,
  }
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function unsync(value: string): string {
  return value.replace(/^\[\d{2}:\d{2}(?:[.:]\d{1,3})?\]\s?/gm, "").trim()
}

export type PlaceHit = {
  label: string
  latitude: number
  longitude: number
}

export function pickPlace(payload: unknown): PlaceHit | null {
  const results = record(payload)?.results
  const row = Array.isArray(results) ? record(results[0]) : null
  if (!row || typeof row.latitude !== "number" || typeof row.longitude !== "number") return null
  const name = text(row.name)
  if (!name) return null
  const region = text(row.admin1)
  const country = text(row.country) || text(row.country_code)
  const label = [name, region && region !== name ? region : "", country].filter(Boolean).join(", ")
  return { label, latitude: row.latitude, longitude: row.longitude }
}

export type WeatherHit = {
  condition: string
  icon: string
  celsius: number
  temperature: string
  feelsLike: string
  humidity: string
  wind: string
  high: string
  low: string
  rainChance: string
  localTime: string
}

export function describeWeather(payload: unknown): WeatherHit | null {
  const root = record(payload)
  const current = record(root?.current)
  const units = record(root?.current_units)
  if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") return null
  const temperatureUnit = text(units?.temperature_2m) || "°C"
  const windUnit = text(units?.wind_speed_10m) || "km/h"
  const degrees = (value: unknown) => (typeof value === "number" ? `${formatNumber(value)} ${temperatureUnit}` : "")
  const daily = record(root?.daily)
  const first = (value: unknown) => (Array.isArray(value) ? value[0] : undefined)
  const rain = first(daily?.precipitation_probability_max)
  const time = text(current.time)
  return {
    condition: weatherLabel(current.weather_code),
    icon: weatherIcon(current.weather_code, current.is_day !== 0),
    celsius: current.temperature_2m,
    temperature: degrees(current.temperature_2m),
    feelsLike: degrees(current.apparent_temperature),
    humidity: typeof current.relative_humidity_2m === "number" ? `${Math.round(current.relative_humidity_2m)}%` : "",
    wind: typeof current.wind_speed_10m === "number" ? `${Math.round(current.wind_speed_10m)} ${windUnit}` : "",
    high: degrees(first(daily?.temperature_2m_max)),
    low: degrees(first(daily?.temperature_2m_min)),
    rainChance: typeof rain === "number" ? `${Math.round(rain)}%` : "",
    localTime: /T\d{2}:\d{2}/.test(time) ? time.slice(11, 16) : "",
  }
}

export function weatherIcon(code: number, day = true): string {
  if (code === 0) return day ? "☀️" : "🌙"
  if (code === 1 || code === 2) return day ? "🌤️" : "☁️"
  if (code === 3) return "☁️"
  if (code === 45 || code === 48) return "🌫️"
  if (code >= 51 && code <= 57) return "🌦️"
  if (code >= 61 && code <= 67) return "🌧️"
  if (code >= 71 && code <= 77) return "❄️"
  if (code >= 80 && code <= 82) return "🌦️"
  if (code === 85 || code === 86) return "🌨️"
  if (code >= 95) return "⛈️"
  return "🌡️"
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear"
  if (code === 1) return "Mainly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Fog"
  if (code === 51 || code === 53 || code === 55) return "Drizzle"
  if (code === 56 || code === 57) return "Freezing drizzle"
  if (code === 61 || code === 63) return "Rain"
  if (code === 65) return "Heavy rain"
  if (code === 66 || code === 67) return "Freezing rain"
  if (code === 71 || code === 73 || code === 75 || code === 77) return "Snow"
  if (code === 80 || code === 81) return "Showers"
  if (code === 82) return "Heavy showers"
  if (code === 85 || code === 86) return "Snow showers"
  if (code === 95) return "Thunderstorm"
  if (code === 96 || code === 99) return "Thunderstorm with hail"
  return "Weather"
}

export type WikiHit = {
  title: string
  description: string
  extract: string
  url: string
  image: string
}

export function pickWiki(payload: unknown): WikiHit | null {
  const row = record(payload)
  if (!row) return null
  const title = text(row.title)
  const extract = text(row.extract)
  if (!title || !extract) return null
  const urls = record(record(row.content_urls)?.desktop)
  const image = text(record(row.thumbnail)?.source) || text(record(row.originalimage)?.source)
  return {
    title,
    description: text(row.description),
    extract,
    url: text(urls?.page),
    image: /^https:\/\//i.test(image) ? image : "",
  }
}

export function pickWikiTitle(payload: unknown): string | null {
  const pages = record(payload)?.pages
  const key = Array.isArray(pages) ? text(record(pages[0])?.key) : ""
  return key || null
}

export type DefinitionSense = {
  speech: string
  definition: string
  example: string
}

export type DefinitionHit = {
  word: string
  phonetic: string
  audio: string
  source: string
  senses: DefinitionSense[]
  lines: string[]
}

export function pickDefinition(payload: unknown): DefinitionHit | null {
  const row = Array.isArray(payload) ? record(payload[0]) : null
  if (!row) return null
  const word = text(row.word)
  const meanings = Array.isArray(row.meanings) ? row.meanings : []
  const senses: DefinitionSense[] = []
  for (const meaning of meanings) {
    const item = record(meaning)
    if (!item) continue
    const speech = text(item.partOfSpeech)
    const definitions = Array.isArray(item.definitions) ? item.definitions : []
    for (const definition of definitions) {
      const entry = record(definition)
      const sentence = text(entry?.definition)
      if (!sentence) continue
      senses.push({ speech, definition: sentence, example: text(entry?.example) })
      if (senses.length === 3) break
    }
    if (senses.length === 3) break
  }
  if (!word || senses.length === 0) return null
  const phonetics = Array.isArray(row.phonetics) ? row.phonetics.map(record) : []
  const spoken = phonetics.find((item) => /^https:\/\//i.test(text(item?.audio)))
  const sources = Array.isArray(row.sourceUrls) ? row.sourceUrls.map(text) : []
  return {
    word,
    phonetic: text(row.phonetic) || text(phonetics[0]?.text) || text(spoken?.text),
    audio: text(spoken?.audio),
    source: sources.find((url) => /^https:\/\//i.test(url)) ?? "",
    senses,
    lines: senses.map((sense) => (sense.speech ? `${sense.speech}. ${sense.definition}` : sense.definition)),
  }
}

export type RateArgs = {
  amount: number
  base: string
  quote: string
}

export function parseRateArgs(args: readonly string[]): RateArgs | { error: string } {
  const parts = args.map((part) => part.trim()).filter((part) => part && part.toLowerCase() !== "to")
  const [first, second, third] = parts
  if (parts.length === 2 && first && second && isCode(first) && isCode(second)) {
    return { amount: 1, base: first.toUpperCase(), quote: second.toUpperCase() }
  }
  if (parts.length === 3 && first && second && third && isAmount(first) && isCode(second) && isCode(third)) {
    const amount = Number(first.replace(/,/g, ""))
    if (amount <= 0 || amount > 1_000_000_000) return { error: "Use an amount above 0 and under 1,000,000,000." }
    return { amount, base: second.toUpperCase(), quote: third.toUpperCase() }
  }
  return { error: "Use rate USD IDR, or rate 10 USD IDR." }
}

function isCode(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value)
}

function isAmount(value: string): boolean {
  return /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(value) || /^\d+(\.\d+)?$/.test(value)
}

export type RateHit = {
  date: string
  base: string
  quote: string
  rate: number
}

export function pickRate(payload: unknown): RateHit | null {
  const row = Array.isArray(payload) ? record(payload[0]) : record(payload)
  if (!row || typeof row.rate !== "number" || !Number.isFinite(row.rate)) return null
  const base = text(row.base)
  const quote = text(row.quote)
  if (!base || !quote) return null
  return { date: text(row.date), base, quote, rate: row.rate }
}

export function currencyFlag(code: string): string {
  const upper = code.toUpperCase()
  if (upper === "EUR") return "🇪🇺"
  if (!/^[A-Z]{3}$/.test(upper)) return "💱"
  return [...upper.slice(0, 2)].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("")
}

export type AnimeHit = {
  title: string
  english: string
  facts: string[]
  genres: string[]
  description: string
  url: string
  cover: string
  banner: string
  color: number | null
}

export function pickAnime(payload: unknown): AnimeHit | null {
  const media = record(record(record(payload)?.data)?.Media)
  if (!media) return null
  const titles = record(media.title)
  const romaji = text(titles?.romaji)
  const english = text(titles?.english)
  const title = english || romaji
  if (!title) return null
  const cover = record(media.coverImage)
  const studios = record(media.studios)?.nodes
  const studio = Array.isArray(studios) ? record(studios[0]) : null
  const season = [labelSeason(text(media.season)), typeof media.seasonYear === "number" ? String(media.seasonYear) : ""]
    .filter(Boolean)
    .join(" ")
  const facts = [
    labelFormat(text(media.format)) ? `📺 ${labelFormat(text(media.format))}` : "",
    labelStatus(text(media.status)) ? `${statusIcon(text(media.status))} ${labelStatus(text(media.status))}` : "",
    typeof media.episodes === "number" ? `🎞️ ${media.episodes} episodes` : "",
    typeof media.averageScore === "number" ? `⭐ ${media.averageScore}/100` : "",
    season ? `🗓️ ${season}` : "",
    text(studio?.name) ? `🏢 ${text(studio?.name)}` : "",
  ].filter(Boolean)
  const genres = Array.isArray(media.genres)
    ? media.genres.map(text).filter(Boolean).slice(0, 6)
    : []
  return {
    title,
    english: romaji && romaji !== title ? romaji : "",
    facts,
    genres,
    description: clip(stripTags(text(media.description)), 600),
    url: text(media.siteUrl),
    cover: httpsUrl(text(cover?.extraLarge) || text(cover?.large)),
    banner: httpsUrl(text(media.bannerImage)),
    color: hexColor(text(cover?.color)),
  }
}

function labelSeason(value: string): string {
  if (value === "WINTER") return "Winter"
  if (value === "SPRING") return "Spring"
  if (value === "SUMMER") return "Summer"
  if (value === "FALL") return "Fall"
  return ""
}

function statusIcon(value: string): string {
  if (value === "RELEASING") return "🟢"
  if (value === "NOT_YET_RELEASED") return "⏳"
  if (value === "CANCELLED") return "⛔"
  if (value === "HIATUS") return "⏸️"
  return "✅"
}

function httpsUrl(value: string): string {
  return /^https:\/\//i.test(value) ? value : ""
}

function hexColor(value: string): number | null {
  const match = value.match(/^#([0-9a-f]{6})$/i)
  return match?.[1] ? Number.parseInt(match[1], 16) : null
}

function labelFormat(value: string): string {
  if (value === "TV") return "TV"
  if (value === "TV_SHORT") return "TV short"
  if (value === "MOVIE") return "Movie"
  if (value === "SPECIAL") return "Special"
  if (value === "OVA") return "OVA"
  if (value === "ONA") return "ONA"
  if (value === "MUSIC") return "Music"
  return ""
}

function labelStatus(value: string): string {
  if (value === "FINISHED") return "Finished"
  if (value === "RELEASING") return "Releasing"
  if (value === "NOT_YET_RELEASED") return "Not yet released"
  if (value === "CANCELLED") return "Cancelled"
  if (value === "HIATUS") return "Hiatus"
  return ""
}

export type TriviaHit =
  | { kind: "limit" }
  | { kind: "empty" }
  | { kind: "question"; category: string; difficulty: string; question: string; choices: string[]; answer: string }

export function pickTrivia(payload: unknown, random: () => number = Math.random): TriviaHit | null {
  const row = record(payload)
  if (!row || typeof row.response_code !== "number") return null
  if (row.response_code === 5) return { kind: "limit" }
  const results = Array.isArray(row.results) ? record(row.results[0]) : null
  if (!results) return row.response_code === 0 ? { kind: "empty" } : null
  const question = decodeHtml(text(results.question))
  const correct = decodeHtml(text(results.correct_answer))
  const incorrect = Array.isArray(results.incorrect_answers)
    ? results.incorrect_answers.flatMap((item) => {
        const choice = decodeHtml(text(item))
        return choice ? [choice] : []
      })
    : []
  if (!question || !correct) return { kind: "empty" }
  const choices = shuffle([correct, ...incorrect], random)
  return {
    kind: "question",
    category: decodeHtml(text(results.category)),
    difficulty: decodeHtml(text(results.difficulty)),
    question,
    choices,
    answer: correct,
  }
}

export type StoryHit = {
  title: string
  url: string
  source: string
  image?: string
  discussion?: string
}

export function pickRssHeadlines(xml: string, limit = 5): StoryHit[] {
  const stories: StoryHit[] = []
  for (const item of xml.split(/<item\b/i).slice(1)) {
    const source = cleanRss(innerTag(item, "News:Source")) || cleanRss(innerTag(item, "source"))
    const title = stripSource(cleanRss(innerTag(item, "title")), source)
    const url = unwrapNewsLink(cleanRss(innerTag(item, "link")))
    const image = newsThumb(cleanRss(innerTag(item, "News:Image")))
    if (!title || !/^https?:\/\//i.test(url)) continue
    stories.push({ title, url, source, ...(image ? { image } : {}) })
    if (stories.length === limit) break
  }
  return stories
}

function unwrapNewsLink(url: string): string {
  try {
    const parsed = new URL(url)
    if (/(^|\.)bing\.com$/i.test(parsed.hostname) && /apiclick/i.test(parsed.pathname)) {
      const target = parsed.searchParams.get("url")
      if (target && /^https?:\/\//i.test(target)) return preferHttps(target)
    }
  } catch {
    // keep the original link
  }
  return preferHttps(url)
}

function newsThumb(url: string): string {
  if (!/^https?:\/\//i.test(url)) return ""
  const https = preferHttps(url)
  if (/[?&]w=\d+/i.test(https)) return https.slice(0, 2048)
  return `${https}${https.includes("?") ? "&" : "?"}w=320&h=180`.slice(0, 2048)
}

function preferHttps(url: string): string {
  return url.replace(/^http:\/\//i, "https://")
}

export function pickStories(payload: unknown, limit = 5): StoryHit[] {
  const hits = record(payload)?.hits
  if (!Array.isArray(hits)) return []
  const stories: StoryHit[] = []
  for (const hit of hits) {
    const row = record(hit)
    if (!row) continue
    const title = text(row.title)
    const id = text(row.objectID)
    const discussion = /^\d+$/.test(id) ? `https://news.ycombinator.com/item?id=${id}` : ""
    const url = text(row.url) || discussion
    if (!title || !/^https?:\/\//i.test(url)) continue
    const meta = [
      typeof row.points === "number" ? `▲ ${row.points}` : "",
      typeof row.num_comments === "number" ? `💬 ${row.num_comments}` : "",
      text(row.author) ? `by ${text(row.author)}` : "",
    ]
      .filter(Boolean)
      .join("  ·  ")
    stories.push({
      title,
      url,
      source: meta,
      ...(discussion && discussion !== url ? { discussion } : {}),
    })
    if (stories.length === limit) break
  }
  return stories
}

export function pickOgImage(html: string, pageUrl: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (key !== "og:image" && key !== "og:image:secure_url" && key !== "twitter:image") continue
    const content = decodeHtml(tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").trim()
    if (!content) continue
    try {
      const resolved = preferHttps(new URL(content, pageUrl).toString())
      if (resolved.startsWith("https://") && resolved.length <= 2048) return resolved
    } catch {
      // try the next tag
    }
  }
  return ""
}

function innerTag(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"))
  return match?.[1] ?? ""
}

function cleanRss(value: string): string {
  return decodeHtml(value.replace(/<!\[CDATA\[|\]\]>/g, "")).replace(/\s+/g, " ").trim()
}

function stripSource(title: string, source: string): string {
  const suffix = source ? ` - ${source}` : ""
  return suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title
}

function shuffle(values: string[], random: () => number): string[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = copy[index] ?? ""
    copy[index] = copy[swap] ?? ""
    copy[swap] = current
  }
  return copy
}

function clip(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
