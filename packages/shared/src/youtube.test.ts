import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPlayArgs, parseYoutubeTarget } from "./youtube"

const video = "abcdefghijk"

describe("parseYoutubeTarget", () => {
  it("membaca video, shorts, dan playlist", () => {
    assert.deepEqual(parseYoutubeTarget(`https://youtu.be/${video}`), { type: "video", id: video })
    assert.deepEqual(parseYoutubeTarget(`https://www.youtube.com/watch?v=${video}&t=12`), {
      type: "video",
      id: video,
    })
    assert.deepEqual(parseYoutubeTarget(`https://www.youtube.com/shorts/${video}`), {
      type: "video",
      id: video,
    })
    assert.deepEqual(parseYoutubeTarget(`https://music.youtube.com/watch?v=${video}`), {
      type: "video",
      id: video,
    })
    assert.deepEqual(
      parseYoutubeTarget("https://www.youtube.com/playlist?list=PLabcdefghijk1234"),
      { type: "playlist", id: "PLabcdefghijk1234" },
    )
  })

  it("menganggap video di dalam playlist sebagai satu video", () => {
    assert.deepEqual(
      parseYoutubeTarget(`https://www.youtube.com/watch?v=${video}&list=PLabcdefghijk1234`),
      { type: "video", id: video },
    )
    assert.deepEqual(
      parseYoutubeTarget(`https://www.youtube.com/watch?v=${video}&list=RD${video}`),
      { type: "video", id: video },
    )
  })

  it("menolak host lain", () => {
    assert.equal(parseYoutubeTarget("https://example.com/watch?v=abcdefghijk"), null)
    assert.equal(parseYoutubeTarget("bukan-tautan"), null)
  })
})

describe("classifyPlayArgs", () => {
  it("menyimpan teks biasa sebagai pencarian YouTube", () => {
    assert.deepEqual(classifyPlayArgs(["despacito"]), {
      kind: "search",
      fresh: false,
      query: "despacito",
    })
    assert.deepEqual(classifyPlayArgs(["new", "tema", "iris"]), {
      kind: "search",
      fresh: true,
      query: "tema iris",
    })
    assert.deepEqual(classifyPlayArgs(["baru", "tema", "iris"]), {
      kind: "search",
      fresh: true,
      query: "tema iris",
    })
    assert.deepEqual(classifyPlayArgs(["baru"]), { kind: "search", fresh: true, query: "" })
  })

  it("mengumpulkan beberapa tautan dan menandai playlist baru", () => {
    assert.deepEqual(
      classifyPlayArgs([
        "baru",
        `https://youtu.be/${video}`,
        "https://www.youtube.com/playlist?list=PLabcdefghijk1234",
      ]),
      {
        kind: "youtube",
        fresh: true,
        items: [
          { type: "video", id: video },
          { type: "playlist", id: "PLabcdefghijk1234" },
        ],
      },
    )
  })
})
