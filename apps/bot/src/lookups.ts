import {
  currencyFlag,
  describeWeather,
  lyricQuery,
  parseRateArgs,
  pickAnime,
  pickDefinition,
  pickLyrics,
  pickOgImage,
  pickPlace,
  pickRate,
  pickRssHeadlines,
  pickStories,
  pickTrivia,
  pickWiki,
  pickWikiTitle,
  readable,
  type DefinitionSense,
  type RateArgs,
  type StoryHit,
} from "@iris/shared"
import { safe, warn, type Note, type NoteLink } from "./reply"

const USER_AGENT = "Iris (https://iris.gproject.dev)"
const HN_ORANGE = 0xff6600
const WIKI_GREY = 0xc8ccd1
const DICTIONARY_BLUE = 0x6c9bd2
const LYRICS_VIOLET = 0xb48ead
const MONEY_GREEN = 0x6aa84f
const CACHE_MS = 10 * 60 * 1000
const TRIVIA_GAP_MS = 5_000
const PREVIEW_MS = 3_500
const PREVIEW_BYTES = 256 * 1024
const quiet = warn("Lookup", "That lookup did not answer. Try again in a moment.")
const cache = new Map<string, { at: number; note: Note }>()
let triviaAt = 0

export async function lyricsLookup(query: string, fromQueue: boolean, artwork: string | null = null): Promise<Note> {
  const title = query.trim().slice(0, 200)
  if (!title) return warn("No song", "Name a song, or play one first.")
  const found = await remember(`lyrics:${title.toLowerCase()}`, () => loadLyrics(title))
  if (found.tone === "warn" || !fromQueue) return found
  return {
    ...found,
    thumbnail: artwork ?? found.thumbnail,
    footer: `${found.footer ?? "Lyrics from LRCLIB"}  ·  From the song playing in this server`,
  }
}

export async function weatherLookup(query: string): Promise<Note> {
  const city = query.trim().slice(0, 80)
  if (!city) return warn("No city", "Name a city.")
  return remember(`weather:${city.toLowerCase()}`, () => loadWeather(city))
}

export async function wikiLookup(query: string): Promise<Note> {
  const topic = query.trim().slice(0, 200)
  if (!topic) return warn("No topic", "Name a topic.")
  return remember(`wiki:${topic.toLowerCase()}`, () => loadWiki(topic))
}

export async function defineLookup(query: string): Promise<Note> {
  const word = query.trim().slice(0, 80)
  if (!word) return warn("No word", "Name a word.")
  return remember(`define:${word.toLowerCase()}`, () => loadDefinition(word))
}

export async function rateLookup(args: readonly string[]): Promise<Note> {
  const parsed = parseRateArgs(args)
  if ("error" in parsed) return warn("Exchange rate", parsed.error)
  if (parsed.base === parsed.quote) {
    return {
      kicker: "💱 Rate",
      title: `${currencyFlag(parsed.base)} ${formatAmount(parsed.amount)} ${parsed.base}`,
      description: "-# That is the same currency.",
      accent: MONEY_GREEN,
    }
  }
  return remember(`rate:${parsed.amount}:${parsed.base}:${parsed.quote}`, () => loadRate(parsed))
}

export async function animeLookup(query: string): Promise<Note> {
  const title = query.trim().slice(0, 200)
  if (!title) return warn("No title", "Name an anime.")
  return remember(`anime:${title.toLowerCase()}`, () => loadAnime(title))
}

export async function newsLookup(query: string): Promise<Note> {
  const topic = query.trim().slice(0, 120)
  if (!topic) return warn("No topic", "Name a topic, such as Bali or climate.")
  return remember(`news:${topic.toLowerCase()}`, () => loadNews(topic))
}

export async function hnLookup(query: string): Promise<Note> {
  const topic = query.trim().slice(0, 120)
  return remember(`hn:${topic.toLowerCase()}`, () => loadHn(topic))
}

export async function triviaLookup(): Promise<Note> {
  if (Date.now() - triviaAt < TRIVIA_GAP_MS) return warn("Trivia", "Wait a few seconds before the next question.")
  const loaded = await readJson("https://opentdb.com/api.php?amount=1&type=multiple")
  triviaAt = Date.now()
  if (!loaded.ok) return quiet
  const hit = pickTrivia(loaded.body)
  if (!hit || hit.kind === "empty") return warn("Trivia", "No question came back. Try again in a moment.")
  if (hit.kind === "limit") return warn("Trivia", "Trivia is cooling down. Try again in a few seconds.")
  const choices = hit.choices.map((choice, index) => `**${String.fromCharCode(65 + index)}.** ${readable(choice, 300)}`)
  const answerIndex = hit.choices.indexOf(hit.answer)
  const letter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : ""
  const level = difficultyLevel(hit.difficulty)
  return {
    kicker: "❓ Trivia",
    title: safe(hit.category || "Trivia"),
    description: [
      level.label ? `-# ${level.label}` : "",
      `### ${readable(hit.question, 500)}`,
      choices.join("\n"),
      `Answer: ||${letter ? `**${letter}.** ` : ""}${readable(hit.answer, 300)}||`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    accent: level.accent,
    footer: "Question from Open Trivia DB",
  }
}

function difficultyLevel(value: string): { label: string; accent?: number } {
  const level = value.toLowerCase()
  if (level === "easy") return { label: "🟢 Easy", accent: 0x57b36a }
  if (level === "medium") return { label: "🟡 Medium", accent: 0xe5b94e }
  if (level === "hard") return { label: "🔴 Hard", accent: 0xd9534f }
  return { label: value ? safe(value) : "" }
}

async function loadLyrics(query: string): Promise<Note> {
  const softened = lyricQuery(query)
  let hit = await searchLyrics(query)
  if (!hit && softened && softened.toLowerCase() !== query.toLowerCase()) hit = await searchLyrics(softened)
  if (!hit) return warn("No lyrics", "No lyrics matched that title.")
  const facts = [hit.album ? `💿 ${safe(hit.album)}` : "", hit.duration ? `⏱️ ${hit.duration}` : ""].filter(Boolean).join("  ·  ")
  const intro = [hit.artist ? `**${safe(hit.artist)}**` : "", facts ? `-# ${facts}` : ""].filter(Boolean).join("\n")
  const lyrics = hit.instrumental
    ? "*This recording is marked instrumental.*"
    : [readable(hit.lyrics, 1500), hit.lyrics.length > 1500 ? "-# The rest of the lyrics is cut." : ""].filter(Boolean).join("\n\n")
  return {
    kicker: "📝 Lyrics",
    title: safe(hit.title || query),
    description: [intro, lyrics].filter(Boolean).join("\n\n"),
    accent: LYRICS_VIOLET,
    footer: "Lyrics from LRCLIB",
  }
}

async function searchLyrics(query: string) {
  const loaded = await readJson(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`)
  if (!loaded.ok) return null
  const hit = pickLyrics(loaded.body)
  if (!hit || (!hit.lyrics && !hit.instrumental)) return null
  return hit
}

async function loadWeather(city: string): Promise<Note> {
  const geo = await readJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`)
  const place = geo.ok ? pickPlace(geo.body) : null
  if (!place) return warn("No city", "No city matched that name.")
  const forecast = await readJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto",
  )
  const weather = forecast.ok ? describeWeather(forecast.body) : null
  if (!weather) return quiet
  const summary = [`**${weather.condition}**`, weather.feelsLike ? `feels like ${weather.feelsLike}` : ""]
    .filter(Boolean)
    .join("  ·  ")
  const facts = [
    weather.high ? `⬆️ ${weather.high}` : "",
    weather.low ? `⬇️ ${weather.low}` : "",
    weather.humidity ? `💧 ${weather.humidity}` : "",
    weather.wind ? `🌬️ ${weather.wind}` : "",
    weather.rainChance ? `☔ ${weather.rainChance}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ")
  const lat = place.latitude.toFixed(4)
  const lon = place.longitude.toFixed(4)
  return {
    kicker: "🌤️ Weather",
    title: safe(place.label),
    description: [
      `# ${weather.icon} ${weather.temperature}`,
      summary,
      facts,
      weather.localTime ? `-# Local time ${weather.localTime}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    accent: temperatureAccent(weather.celsius),
    footer: "Weather from Open-Meteo",
    links: [{ label: "Open map", url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}` }],
  }
}

function temperatureAccent(celsius: number): number {
  if (celsius < 10) return 0x6fa8dc
  if (celsius < 20) return 0x76c7c0
  if (celsius < 28) return 0xd7a15f
  if (celsius < 33) return 0xe69138
  return 0xcc4125
}

async function loadWiki(topic: string): Promise<Note> {
  const direct = await wikiSummary(topic.replace(/ /g, "_"))
  if (direct) return direct
  const search = await readJson(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(topic)}&limit=1`)
  const key = search.ok ? pickWikiTitle(search.body) : null
  if (!key) return warn("No page", "No Wikipedia page matched that topic.")
  return (await wikiSummary(key)) ?? warn("No page", "No Wikipedia page matched that topic.")
}

async function wikiSummary(title: string): Promise<Note | null> {
  const loaded = await readJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
  if (!loaded.ok) return null
  const page = pickWiki(loaded.body)
  if (!page) return null
  return {
    kicker: "📚 Wikipedia",
    title: safe(page.title),
    description: [page.description ? `-# ${safe(page.description)}` : "", readable(page.extract, 900)].filter(Boolean).join("\n\n"),
    thumbnail: page.image || undefined,
    accent: WIKI_GREY,
    footer: "Summary from Wikipedia",
    links: linkIf("Read on Wikipedia", page.url),
  }
}

async function loadDefinition(word: string): Promise<Note> {
  const loaded = await readJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
  const hit = loaded.ok ? pickDefinition(loaded.body) : null
  if (!hit) return warn("No definition", "No English definition matched that word.")
  return {
    kicker: "📘 Define",
    title: safe(hit.word),
    description: [hit.phonetic ? `-# ${safe(hit.phonetic)}` : "", senseLines(hit.senses)].filter(Boolean).join("\n\n"),
    accent: DICTIONARY_BLUE,
    footer: "Definitions from Free Dictionary",
    links: [...linkIf("🔊 Listen", hit.audio), ...linkIf("Wiktionary", hit.source)],
  }
}

function senseLines(senses: DefinitionSense[]): string {
  const groups: string[] = []
  let speech = ""
  let count = 0
  for (const sense of senses) {
    if (sense.speech !== speech || groups.length === 0) {
      speech = sense.speech
      count = 0
      groups.push(speech ? `**${safe(speech)}**` : "")
    }
    count += 1
    const example = sense.example ? `\n> *${readable(sense.example, 200)}*` : ""
    groups.push(`${count}. ${readable(sense.definition, 400)}${example}`)
  }
  return groups.filter(Boolean).join("\n")
}

async function loadRate(parsed: RateArgs): Promise<Note> {
  const loaded = await readJson(`https://api.frankfurter.dev/v2/rates?base=${parsed.base}&quotes=${parsed.quote}`)
  const hit = loaded.ok ? pickRate(loaded.body) : null
  if (!hit) return warn("Exchange rate", "Those currencies were not found. Use three-letter codes, such as USD and IDR.")
  const converted = parsed.amount * hit.rate
  const inverse = hit.rate > 0 ? 1 / hit.rate : 0
  return {
    kicker: "💱 Rate",
    title: `${currencyFlag(hit.base)} ${formatAmount(parsed.amount)} ${hit.base}`,
    description: [
      `# ${currencyFlag(hit.quote)} ${formatAmount(converted)} ${hit.quote}`,
      `1 ${hit.base} = ${formatAmount(hit.rate)} ${hit.quote}` +
        (inverse ? `  ·  1 ${hit.quote} = ${formatAmount(inverse)} ${hit.base}` : ""),
      `-# Daily reference rate${hit.date ? ` on ${hit.date}` : ""}`,
    ].join("\n"),
    accent: MONEY_GREEN,
    footer: "Rates from Frankfurter",
  }
}

function linkIf(label: string, url: string): NoteLink[] {
  return /^https:\/\//i.test(url) && url.length <= 512 ? [{ label, url }] : []
}

async function loadNews(topic: string): Promise<Note> {
  const loaded = await readText(`https://www.bing.com/news/search?q=${encodeURIComponent(topic)}&format=rss`)
  const stories = loaded.ok ? pickRssHeadlines(loaded.body) : []
  if (stories.length === 0) return warn("No headlines", "No headlines matched that topic.")
  return storyCard("📰 News", safe(topic), stories, "Headlines from Bing News", {
    images: stories.map((story) => story.image),
    more: { label: "More on Bing News", url: `https://www.bing.com/news/search?q=${encodeURIComponent(topic)}` },
  })
}

async function loadHn(topic: string): Promise<Note> {
  const url = topic
    ? `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=5`
    : "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5"
  const loaded = await readJson(url)
  const stories = loaded.ok ? pickStories(loaded.body) : []
  if (stories.length === 0) return warn("No stories", "Hacker News did not return a story.")
  const images = await Promise.all(stories.map((story) => previewImage(story.url)))
  return storyCard("🟧 Hacker News", topic ? safe(topic) : "Front page", stories, "From Hacker News", {
    images,
    accent: HN_ORANGE,
    more: topic
      ? { label: "More on Hacker News", url: `https://hn.algolia.com/?q=${encodeURIComponent(topic)}` }
      : { label: "Open Hacker News", url: "https://news.ycombinator.com/" },
  })
}

async function previewImage(url: string): Promise<string | undefined> {
  const signal = AbortSignal.timeout(PREVIEW_MS)
  let target = url
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      if (!publicHttps(target)) return undefined
      const response = await fetch(target, {
        headers: { Accept: "text/html", "User-Agent": USER_AGENT },
        redirect: "manual",
        signal,
      })
      const next = response.headers.get("location")
      if (response.status >= 300 && response.status < 400 && next) {
        await response.body?.cancel().catch(() => undefined)
        target = new URL(next, target).toString()
        continue
      }
      if (!response.ok || !/text\/html/i.test(response.headers.get("content-type") ?? "")) {
        await response.body?.cancel().catch(() => undefined)
        return undefined
      }
      return pickOgImage(await readHead(response), target) || undefined
    }
  } catch {
    // no preview for this story
  }
  return undefined
}

async function readHead(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const decoder = new TextDecoder()
  let html = ""
  let bytes = 0
  while (bytes < PREVIEW_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    html += decoder.decode(value, { stream: true })
    if (/<\/head>/i.test(html)) break
  }
  await reader.cancel().catch(() => undefined)
  return html
}

function publicHttps(url: string): boolean {
  try {
    const { protocol, hostname, port } = new URL(url)
    if (protocol !== "https:" || (port && port !== "443")) return false
    if (hostname === "news.ycombinator.com") return false
    if (/^\[|^\d+(\.\d+){3}$/.test(hostname)) return false
    return hostname.includes(".") && !/(^|\.)(localhost|local|internal|lan|home)$/i.test(hostname)
  } catch {
    return false
  }
}

function storyCard(
  kicker: string,
  title: string,
  stories: StoryHit[],
  footer: string,
  options: { images?: Array<string | undefined>; accent?: number; more?: NoteLink },
): Note {
  return {
    kicker,
    title,
    fields: stories.map((story, index) => ({
      name: `${index + 1}. ${readable(story.title, 150)}`,
      value: storyValue(story),
      image: options.images?.[index],
    })),
    accent: options.accent,
    footer,
    links: options.more ? linkIf(options.more.label, options.more.url) : [],
  }
}

function storyValue(story: StoryHit): string {
  const source = story.source ? readable(story.source, 80) : ""
  const links = [
    story.url.length <= 900 ? mdLink("Read article", story.url) : "",
    story.discussion ? mdLink("Comments", story.discussion) : "",
  ]
    .filter(Boolean)
    .join("  ·  ")
  return [source, links].filter(Boolean).join("\n") || "—"
}

function mdLink(label: string, url: string): string {
  const text = label.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]")
  return `[${text}](${url.replace(/\)/g, "%29")})`
}

async function loadAnime(title: string): Promise<Note> {
  const loaded = await readJson("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query ($search: String) { Media(search: $search, type: ANIME, isAdult: false) { title { romaji english } description(asHtml: false) episodes format status averageScore season seasonYear genres studios(isMain: true) { nodes { name } } coverImage { extraLarge large color } bannerImage siteUrl } }",
      variables: { search: title },
    }),
  })
  const hit = loaded.ok ? pickAnime(loaded.body) : null
  if (!hit) return warn("No anime", "No anime matched that title.")
  const lines = [
    hit.english ? `-# ${safe(hit.english)}` : "",
    hit.facts.join("  ·  "),
    hit.genres.length ? hit.genres.map((genre) => `\`${genre.replace(/`/g, "")}\``).join(" ") : "",
    hit.description ? readable(hit.description, 600) : "",
  ].filter(Boolean)
  return {
    kicker: "🎬 Anime",
    title: safe(hit.title),
    description: lines.join("\n\n"),
    image: hit.banner || undefined,
    thumbnail: hit.cover || undefined,
    accent: hit.color ?? undefined,
    footer: "From AniList",
    links: linkIf("Open on AniList", hit.url),
  }
}

async function remember(key: string, load: () => Promise<Note>): Promise<Note> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.note
  const value = await load()
  if (value.tone !== "warn") {
    cache.set(key, { at: Date.now(), note: value })
    if (cache.size > 200) cache.clear()
  }
  return value
}

function formatAmount(value: number): string {
  const digits = Math.abs(value) >= 100 ? 2 : 6
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value)
}

async function readText(url: string): Promise<{ ok: true; body: string } | { ok: false }> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return { ok: false }
    return { ok: true, body: await response.text() }
  } catch (error) {
    console.error("Lookup failed", new URL(url).origin, error)
    return { ok: false }
  }
}

async function readJson(url: string, init?: RequestInit): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return { ok: false }
    return { ok: true, body: await response.json() }
  } catch (error) {
    console.error("Lookup failed", new URL(url).origin, error)
    return { ok: false }
  }
}
