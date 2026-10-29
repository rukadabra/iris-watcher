import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  describeWeather,
  lyricQuery,
  parseRateArgs,
  pickAnime,
  pickDefinition,
  pickLyrics,
  pickPlace,
  pickRate,
  pickTrivia,
  pickWiki,
  pickWikiTitle,
  readable,
  weatherLabel,
} from "./lookups"

describe("lookups", () => {
  it("cleans a YouTube title before a lyrics search", () => {
    assert.equal(lyricQuery("Luis Fonsi - Despacito (Official Video)"), "Luis Fonsi - Despacito")
  })

  it("prefers plain lyrics and falls back to synced lines", () => {
    assert.equal(
      pickLyrics([{ trackName: "Song", artistName: "Artist", plainLyrics: "line", syncedLyrics: "[00:01.00] other" }])
        ?.lyrics,
      "line",
    )
    assert.equal(pickLyrics([{ trackName: "Song", artistName: "Artist", syncedLyrics: "[00:01.00] other" }])?.lyrics, "other")
    assert.equal(pickLyrics([{ trackName: "Song", instrumental: true }])?.instrumental, true)
  })

  it("reads a city and the current weather", () => {
    const place = pickPlace({
      results: [{ name: "Denpasar", admin1: "Bali", country: "Indonesia", latitude: -8.65, longitude: 115.22 }],
    })
    assert.equal(place?.label, "Denpasar, Bali, Indonesia")
    const weather = describeWeather({
      current: { temperature_2m: 28.4, weather_code: 2, relative_humidity_2m: 74, wind_speed_10m: 12 },
      current_units: { temperature_2m: "°C", wind_speed_10m: "km/h" },
    })
    assert.equal(weather?.temperature, "28.4 °C")
    assert.equal(weather?.condition, "Partly cloudy")
    assert.equal(weatherLabel(95), "Thunderstorm")
  })

  it("reads a Wikipedia summary and a search title", () => {
    const page = pickWiki({
      title: "Denpasar",
      extract: "Denpasar is a city.",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Denpasar" } },
    })
    assert.equal(page?.url, "https://en.wikipedia.org/wiki/Denpasar")
    assert.equal(pickWikiTitle({ pages: [{ key: "Denpasar" }] }), "Denpasar")
  })

  it("reads up to three definitions", () => {
    const hit = pickDefinition([
      {
        word: "iris",
        phonetic: "/ˈaɪɹɪs/",
        meanings: [
          { partOfSpeech: "noun", definitions: [{ definition: "A plant." }, { definition: "A part of the eye." }] },
          { partOfSpeech: "verb", definitions: [{ definition: "To make iridescent." }, { definition: "Ignored." }] },
        ],
      },
    ])
    assert.equal(hit?.lines.length, 3)
    assert.equal(hit?.lines[0], "noun. A plant.")
  })

  it("parses a rate and reads the daily quote", () => {
    assert.deepEqual(parseRateArgs(["10", "usd", "to", "idr"]), { amount: 10, base: "USD", quote: "IDR" })
    assert.deepEqual(parseRateArgs(["usd", "idr"]), { amount: 1, base: "USD", quote: "IDR" })
    assert.equal("error" in parseRateArgs(["usd"]), true)
    assert.equal(pickRate([{ date: "2026-10-29", base: "USD", quote: "IDR", rate: 18159 }])?.rate, 18159)
  })

  it("strips anime description markup", () => {
    const hit = pickAnime({
      data: {
        Media: {
          title: { romaji: "SPY×FAMILY", english: "SPY x FAMILY" },
          description: "A spy.<br><i>Watch</i>",
          episodes: 12,
          format: "TV",
          status: "FINISHED",
          averageScore: 86,
          siteUrl: "https://anilist.co/anime/1",
        },
      },
    })
    assert.equal(hit?.title, "SPY×FAMILY")
    assert.equal(hit?.lines.at(-1), "A spy.\nWatch")
  })

  it("hides the trivia answer among the choices", () => {
    const hit = pickTrivia(
      {
        response_code: 0,
        results: [
          {
            category: "General",
            difficulty: "easy",
            question: "Say &quot;hi&quot;",
            correct_answer: "Yes",
            incorrect_answers: ["No", "Maybe"],
          },
        ],
      },
      () => 0.999,
    )
    assert.equal(hit?.kind, "question")
    if (hit?.kind !== "question") return
    assert.equal(hit.question, 'Say "hi"')
    assert.deepEqual(hit.choices, ["Yes", "No", "Maybe"])
    assert.equal(pickTrivia({ response_code: 5 })?.kind, "limit")
  })

  it("keeps lyrics readable without a mention", () => {
    assert.equal(readable("@everyone\n#line", 40), "@\u200beveryone\n\\#line")
  })
})
