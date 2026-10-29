import {
  describeWeather,
  lyricQuery,
  parseRateArgs,
  pickAnime,
  pickDefinition,
  pickLyrics,
  pickPlace,
  pickRate,
  pickRssHeadlines,
  pickStories,
  pickTrivia,
  pickWiki,
  pickWikiTitle,
  readable,
  type RateArgs,
  type StoryHit,
} from "@iris/shared"
import { note, safe, scene, warn, type Note } from "./reply"

const USER_AGENT = "Iris (https://iris.gproject.dev)"
const CACHE_MS = 10 * 60 * 1000
const TRIVIA_GAP_MS = 5_000
const quiet = warn("Lookup", "That lookup did not answer. Try again in a moment.")
const cache = new Map<string, { at: number; note: Note }>()
let triviaAt = 0

export async function lyricsLookup(query: string, fromQueue: boolean): Promise<Note> {
  const title = query.trim().slice(0, 200)
  if (!title) return warn("No song", "Name a song, or play one first.")
  return remember(`lyrics:${title.toLowerCase()}`, () => loadLyrics(title, fromQueue))
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
    return scene("💱 Rate", `${formatAmount(parsed.amount)} ${parsed.base}`, `-# That is the same currency.`)
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
  const choices = hit.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${readable(choice, 300)}`)
  const answerIndex = hit.choices.indexOf(hit.answer)
  const letter = answerIndex >= 0 ? String.fromCharCode(65 + answerIndex) : ""
  const meta = [hit.category, hit.difficulty].filter(Boolean).join(" · ")
  return note(
    "❓ Trivia",
    [
      meta ? `-# ${readable(meta, 120)}` : "",
      readable(hit.question, 500),
      choices.join("\n"),
      `||${letter ? `${letter}. ` : ""}${readable(hit.answer, 300)}||`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  )
}

async function loadLyrics(query: string, fromQueue: boolean): Promise<Note> {
  const softened = lyricQuery(query)
  let hit = await searchLyrics(query)
  if (!hit && softened && softened.toLowerCase() !== query.toLowerCase()) hit = await searchLyrics(softened)
  if (!hit) return warn("No lyrics", "No lyrics matched that title.")
  const heading = hit.title || query
  if (hit.instrumental) {
    return scene("📝 Lyrics", safe(heading), `${artistLine(hit.artist)}\nThis recording is marked instrumental.\n-# Lyrics from LRCLIB`.trim())
  }
  const source = fromQueue ? "-# From the song playing in this server.\n-# Lyrics from LRCLIB" : "-# Lyrics from LRCLIB"
  const body = [artistLine(hit.artist), readable(hit.lyrics, 1500), hit.lyrics.length > 1500 ? "-# The rest of the lyrics is cut." : "", source]
    .filter(Boolean)
    .join("\n\n")
  return scene("📝 Lyrics", safe(heading), body)
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
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
  )
  const weather = forecast.ok ? describeWeather(forecast.body) : null
  if (!weather) return quiet
  const details = [weather.humidity ? `Humidity ${weather.humidity}.` : "", weather.wind ? `Wind ${weather.wind}.` : ""]
    .filter(Boolean)
    .join(" ")
  return scene(
    "🌤️ Weather",
    safe(place.label),
    `${weather.temperature}, ${weather.condition.toLowerCase()}\n${details}\n-# Weather from Open-Meteo`,
  )
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
  const link = page.url ? `\n${page.url}` : ""
  return scene("📚 Wikipedia", safe(page.title), `${readable(page.extract, 900)}${link}\n-# Summary from Wikipedia`)
}

async function loadDefinition(word: string): Promise<Note> {
  const loaded = await readJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
  const hit = loaded.ok ? pickDefinition(loaded.body) : null
  if (!hit) return warn("No definition", "No English definition matched that word.")
  const phonetic = hit.phonetic ? `\n-# ${safe(hit.phonetic)}` : ""
  return scene("📘 Define", safe(hit.word), `${hit.lines.map((line) => readable(line, 400)).join("\n")}${phonetic}`)
}

async function loadRate(parsed: RateArgs): Promise<Note> {
  const loaded = await readJson(`https://api.frankfurter.dev/v2/rates?base=${parsed.base}&quotes=${parsed.quote}`)
  const hit = loaded.ok ? pickRate(loaded.body) : null
  if (!hit) return warn("Exchange rate", "Those currencies were not found. Use three-letter codes, such as USD and IDR.")
  const converted = parsed.amount * hit.rate
  const when = hit.date ? ` on ${hit.date}` : ""
  return scene(
    "💱 Rate",
    `${formatAmount(parsed.amount)} ${hit.base}`,
    `**${formatAmount(converted)} ${hit.quote}**\n-# Daily rate${when}. 1 ${hit.base} = ${formatAmount(hit.rate)} ${hit.quote}.\n-# Rates from Frankfurter`,
  )
}

async function loadNews(topic: string): Promise<Note> {
  const loaded = await readText(
    `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`,
  )
  const stories = loaded.ok ? pickRssHeadlines(loaded.body) : []
  if (stories.length === 0) return warn("No headlines", "No headlines matched that topic.")
  return note("📰 News", `${storyLines(stories)}\n\n-# Headlines from Google News`)
}

async function loadHn(topic: string): Promise<Note> {
  const url = topic
    ? `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=5`
    : "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5"
  const loaded = await readJson(url)
  const stories = loaded.ok ? pickStories(loaded.body) : []
  if (stories.length === 0) return warn("No stories", "Hacker News did not return a story.")
  const heading = topic ? safe(topic) : "Front page"
  return scene("🟧 Hacker News", heading, `${storyLines(stories)}\n\n-# From Hacker News`)
}

function storyLines(stories: StoryHit[]): string {
  return stories
    .map((story) => {
      const source = story.source ? `\n-# ${readable(story.source, 80)}` : ""
      return `**${readable(story.title, 180)}**${source}\n${story.url}`
    })
    .join("\n\n")
}

async function loadAnime(title: string): Promise<Note> {
  const loaded = await readJson("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } description(asHtml: false) episodes format status averageScore siteUrl } }",
      variables: { search: title },
    }),
  })
  const hit = loaded.ok ? pickAnime(loaded.body) : null
  if (!hit) return warn("No anime", "No anime matched that title.")
  const body = [...hit.lines.map((line) => readable(line, 500)), hit.url, "-# From AniList"].filter(Boolean).join("\n\n")
  return scene("🎬 Anime", safe(hit.title), body)
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

function artistLine(artist: string): string {
  return artist ? `**${safe(artist)}**` : ""
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
