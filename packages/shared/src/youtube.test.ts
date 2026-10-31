import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPlayArgs, parseYoutubeTarget } from "./youtube"

const video = "abcdefghijk"

describe("parseYoutubeTarget", () => {
  it("reads a video, shorts, and a playlist", () => {
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

  it("treats a video inside a playlist as one video", () => {
    assert.deepEqual(
      parseYoutubeTarget(`https://www.youtube.com/watch?v=${video}&list=PLabcdefghijk1234`),
      { type: "video", id: video },
    )
    assert.deepEqual(
      parseYoutubeTarget(`https://www.youtube.com/watch?v=${video}&list=RD${video}`),
      { type: "video", id: video },
    )
  })

  it("rejects another host", () => {
    assert.equal(parseYoutubeTarget("https://example.com/watch?v=abcdefghijk"), null)
    assert.equal(parseYoutubeTarget("not-a-link"), null)
  })
})

describe("classifyPlayArgs", () => {
  it("keeps plain text as a YouTube search", () => {
    assert.deepEqual(classifyPlayArgs(["despacito"]), {
      kind: "search",
      fresh: false,
      query: "despacito",
    })
    assert.deepEqual(classifyPlayArgs(["new", "iris", "theme"]), {
      kind: "search",
      fresh: true,
      query: "iris theme",
    })
    assert.deepEqual(classifyPlayArgs(["new"]), { kind: "search", fresh: true, query: "" })
  })

  it("collects several links and marks a new playlist", () => {
    assert.deepEqual(
      classifyPlayArgs([
        "new",
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
