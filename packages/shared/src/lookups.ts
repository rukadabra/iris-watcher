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
    lyrics: plain || synced,
    instrumental: chosen.instrumental === true && !plain && !synced,
  }
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
  temperature: string
  humidity: string
  wind: string
}

export function describeWeather(payload: unknown): WeatherHit | null {
  const current = record(record(payload)?.current)
  const units = record(record(payload)?.current_units)
  if (!current || typeof current.temperature_2m !== "number" || typeof current.weather_code !== "number") return null
  const temperatureUnit = text(units?.temperature_2m) || "°C"
  const windUnit = text(units?.wind_speed_10m) || "km/h"
  const humidity = typeof current.relative_humidity_2m === "number" ? `${Math.round(current.relative_humidity_2m)}%` : ""
  const wind = typeof current.wind_speed_10m === "number" ? `${Math.round(current.wind_speed_10m)} ${windUnit}` : ""
  return {
    condition: weatherLabel(current.weather_code),
    temperature: `${formatNumber(current.temperature_2m)} ${temperatureUnit}`,
    humidity,
    wind,
  }
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
  extract: string
  url: string
}

export function pickWiki(payload: unknown): WikiHit | null {
  const row = record(payload)
  if (!row) return null
  const title = text(row.title)
  const extract = text(row.extract)
  if (!title || !extract) return null
  const urls = record(record(row.content_urls)?.desktop)
  return { title, extract, url: text(urls?.page) }
}

export function pickWikiTitle(payload: unknown): string | null {
  const pages = record(payload)?.pages
  const key = Array.isArray(pages) ? text(record(pages[0])?.key) : ""
  return key || null
}

export type DefinitionHit = {
  word: string
  phonetic: string
  lines: string[]
}

export function pickDefinition(payload: unknown): DefinitionHit | null {
  const row = Array.isArray(payload) ? record(payload[0]) : null
  if (!row) return null
  const word = text(row.word)
  const meanings = Array.isArray(row.meanings) ? row.meanings : []
  const lines: string[] = []
  for (const meaning of meanings) {
    const item = record(meaning)
    if (!item) continue
    const speech = text(item.partOfSpeech)
    const definitions = Array.isArray(item.definitions) ? item.definitions : []
    for (const definition of definitions) {
      const sentence = text(record(definition)?.definition)
      if (!sentence) continue
      lines.push(speech ? `${speech}. ${sentence}` : sentence)
      if (lines.length === 3) break
    }
    if (lines.length === 3) break
  }
  if (!word || lines.length === 0) return null
  const phonetics = Array.isArray(row.phonetics) ? record(row.phonetics[0]) : null
  return { word, phonetic: text(row.phonetic) || text(phonetics?.text), lines }
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

export type AnimeHit = {
  title: string
  lines: string[]
  url: string
}

export function pickAnime(payload: unknown): AnimeHit | null {
  const media = record(record(record(payload)?.data)?.Media)
  if (!media) return null
  const titles = record(media.title)
  const romaji = text(titles?.romaji)
  const english = text(titles?.english)
  const title = romaji || english
  if (!title) return null
  const lines = [
    english && english !== title ? english : "",
    [labelFormat(text(media.format)), labelStatus(text(media.status))].filter(Boolean).join(" · "),
    typeof media.episodes === "number" ? `${media.episodes} episodes` : "",
    typeof media.averageScore === "number" ? `Score ${media.averageScore}/100` : "",
    clip(stripTags(text(media.description)), 500),
  ].filter(Boolean)
  return { title, lines, url: text(media.siteUrl) }
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
