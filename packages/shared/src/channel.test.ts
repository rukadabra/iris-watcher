import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { channelLiveUrl, channelPageUrl, parseChannelTarget } from "./channel"

const channelId = "UCSJ4gkVC6NrvII8umztf0Ow"

describe("parseChannelTarget", () => {
  it("membaca id, handle, dan tautan channel", () => {
    assert.deepEqual(parseChannelTarget(`https://www.youtube.com/channel/${channelId}`), {
      type: "id",
      id: channelId,
    })
    assert.deepEqual(parseChannelTarget(`https://www.youtube.com/channel/${channelId}/live`), {
      type: "id",
      id: channelId,
    })
    assert.deepEqual(parseChannelTarget("https://m.youtube.com/@LofiGirl/streams"), {
      type: "handle",
      handle: "LofiGirl",
    })
    assert.deepEqual(parseChannelTarget("@LofiGirl"), { type: "handle", handle: "LofiGirl" })
    assert.deepEqual(parseChannelTarget("youtube.com/c/LofiGirl"), { type: "custom", kind: "c", name: "LofiGirl" })
    assert.deepEqual(parseChannelTarget("https://www.youtube.com/user/LofiGirl"), {
      type: "custom",
      kind: "user",
      name: "LofiGirl",
    })
  })

  it("menolak video, host lain, dan handle yang terlalu pendek", () => {
    assert.equal(parseChannelTarget("https://www.youtube.com/watch?v=abcdefghijk"), null)
    assert.equal(parseChannelTarget("https://youtu.be/abcdefghijk"), null)
    assert.equal(parseChannelTarget("https://example.com/@LofiGirl"), null)
    assert.equal(parseChannelTarget("@ab"), null)
  })

  it("menyusun url channel dari target yang sudah divalidasi", () => {
    assert.equal(channelPageUrl({ type: "id", id: channelId }), `https://www.youtube.com/channel/${channelId}`)
    assert.equal(channelPageUrl({ type: "handle", handle: "LofiGirl" }), "https://www.youtube.com/@LofiGirl")
    assert.equal(channelLiveUrl(channelId), `https://www.youtube.com/channel/${channelId}/live`)
  })
})
