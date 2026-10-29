import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  currencyFlag,
  describeWeather,
  lyricQuery,
  parseRateArgs,
  pickAnime,
  pickDefinition,
  pickLyrics,
  pickPlace,
  pickRate,
  pickOgImage,
  pickRssHeadlines,
  pickStories,
  pickTrivia,
  pickWiki,
  pickWikiTitle,
  readable,
  weatherLabel,
} from "./lookups"

describe("lookups", () => {
  it("reads an article preview image", () => {
    assert.equal(
      pickOgImage(`<meta content="/img/a.png?x=1&amp;y=2" property="og:image">`, "http://blog.example/post"),
      "https://blog.example/img/a.png?x=1&y=2",
    )
    assert.equal(pickOgImage(`<meta name="twitter:image" content="https://cdn.example/b.jpg">`, "https://x.example"), "https://cdn.example/b.jpg")
    assert.equal(pickOgImage(`<meta name="description" content="nothing">`, "https://x.example"), "")
  })

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
    assert.equal(pickLyrics([{ trackName: "Song", albumName: "Album", duration: 229, plainLyrics: "x" }])?.duration, "3:49")
  })

  it("reads a city and the current weather", () => {
    const place = pickPlace({
      results: [{ name: "Denpasar", admin1: "Bali", country: "Indonesia", latitude: -8.65, longitude: 115.22 }],
    })
    assert.equal(place?.label, "Denpasar, Bali, Indonesia")
    const weather = describeWeather({
      current: {
        time: "2026-10-29T17:45",
        temperature_2m: 28.4,
        apparent_temperature: 32.1,
        weather_code: 2,
        is_day: 1,
        relative_humidity_2m: 74,
        wind_speed_10m: 12,
      },
      current_units: { temperature_2m: "°C", wind_speed_10m: "km/h" },
      daily: { temperature_2m_max: [31], temperature_2m_min: [24.5], precipitation_probability_max: [40] },
    })
    assert.equal(weather?.temperature, "28.4 °C")
    assert.equal(weather?.feelsLike, "32.1 °C")
    assert.equal(weather?.condition, "Partly cloudy")
    assert.equal(weather?.icon, "🌤️")
    assert.equal(weather?.high, "31 °C")
    assert.equal(weather?.rainChance, "40%")
    assert.equal(weather?.localTime, "17:45")
    assert.equal(weatherLabel(95), "Thunderstorm")
  })

  it("reads a Wikipedia summary and a search title", () => {
    const page = pickWiki({
      title: "Denpasar",
      extract: "Denpasar is a city.",
      description: "Capital of Bali",
      thumbnail: { source: "https://upload.wikimedia.org/denpasar.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Denpasar" } },
    })
    assert.equal(page?.url, "https://en.wikipedia.org/wiki/Denpasar")
    assert.equal(page?.image, "https://upload.wikimedia.org/denpasar.jpg")
    assert.equal(page?.description, "Capital of Bali")
    assert.equal(pickWikiTitle({ pages: [{ key: "Denpasar" }] }), "Denpasar")
  })

  it("reads up to three definitions", () => {
    const hit = pickDefinition([
      {
        word: "iris",
        phonetic: "/ˈaɪɹɪs/",
        phonetics: [{ text: "/ˈaɪɹɪs/" }, { audio: "https://api.dictionaryapi.dev/media/iris-us.mp3" }],
        sourceUrls: ["https://en.wiktionary.org/wiki/iris"],
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "A plant.", example: "The iris bloomed." }, { definition: "A part of the eye." }],
          },
          { partOfSpeech: "verb", definitions: [{ definition: "To make iridescent." }, { definition: "Ignored." }] },
        ],
      },
    ])
    assert.equal(hit?.lines.length, 3)
    assert.equal(hit?.lines[0], "noun. A plant.")
    assert.equal(hit?.senses[0]?.example, "The iris bloomed.")
    assert.equal(hit?.audio, "https://api.dictionaryapi.dev/media/iris-us.mp3")
    assert.equal(hit?.source, "https://en.wiktionary.org/wiki/iris")
  })

  it("parses a rate and reads the daily quote", () => {
    assert.deepEqual(parseRateArgs(["10", "usd", "to", "idr"]), { amount: 10, base: "USD", quote: "IDR" })
    assert.deepEqual(parseRateArgs(["usd", "idr"]), { amount: 1, base: "USD", quote: "IDR" })
    assert.equal("error" in parseRateArgs(["usd"]), true)
    assert.equal(pickRate([{ date: "2026-10-29", base: "USD", quote: "IDR", rate: 18159 }])?.rate, 18159)
    assert.equal(currencyFlag("IDR"), "🇮🇩")
    assert.equal(currencyFlag("EUR"), "🇪🇺")
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
          season: "SPRING",
          seasonYear: 2022,
          genres: ["Action", "Comedy"],
          studios: { nodes: [{ name: "Wit Studio" }] },
          coverImage: { extraLarge: "https://img.anili.st/cover.jpg", color: "#e4a15d" },
          bannerImage: "https://img.anili.st/banner.jpg",
          siteUrl: "https://anilist.co/anime/1",
        },
      },
    })
    assert.equal(hit?.title, "SPY x FAMILY")
    assert.equal(hit?.english, "SPY×FAMILY")
    assert.equal(hit?.description, "A spy.\nWatch")
    assert.deepEqual(hit?.facts, [
      "📺 TV",
      "✅ Finished",
      "🎞️ 12 episodes",
      "⭐ 86/100",
      "🗓️ Spring 2022",
      "🏢 Wit Studio",
    ])
    assert.deepEqual(hit?.genres, ["Action", "Comedy"])
    assert.equal(hit?.color, 0xe4a15d)
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

  it("reads a short list of headlines and stories", () => {
    const headlines = pickRssHeadlines(
      [
        "<item><title><![CDATA[Rain in Bali &amp; Java - BBC]]></title><link>https://news.example/bali</link><source>BBC</source></item>",
        "<item><title>Cable cut</title>",
        "<link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fjakartaglobe.id%2fstory</link>",
        "<News:Source>Jakarta Globe</News:Source>",
        "<News:Image>http://www.bing.com/th?id=ONUT.abc&amp;pid=News</News:Image></item>",
      ].join(""),
    )
    assert.equal(headlines[0]?.title, "Rain in Bali & Java")
    assert.equal(headlines[0]?.source, "BBC")
    assert.equal(headlines[1]?.url, "https://jakartaglobe.id/story")
    assert.equal(headlines[1]?.source, "Jakarta Globe")
    assert.equal(headlines[1]?.image, "https://www.bing.com/th?id=ONUT.abc&pid=News&w=320&h=180")
    const stories = pickStories({
      hits: [
        { title: "Iris", url: "", objectID: "42", points: 12 },
        { title: "Watcher", url: "https://example.test/a", objectID: "43", points: 5, num_comments: 2, author: "lea" },
        { title: "", url: "https://example.test" },
      ],
    })
    assert.deepEqual(stories, [
      { title: "Iris", url: "https://news.ycombinator.com/item?id=42", source: "▲ 12" },
      {
        title: "Watcher",
        url: "https://example.test/a",
        source: "▲ 5  ·  💬 2  ·  by lea",
        discussion: "https://news.ycombinator.com/item?id=43",
      },
    ])
  })

  it("keeps lyrics readable without a mention", () => {
    assert.equal(readable("@everyone\n#line", 40), "@\u200beveryone\n\\#line")
  })
})
