import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readChannelPage, readLivePage } from "./live"

const channelId = "UCSJ4gkVC6NrvII8umztf0Ow"
const videoId = "0sfDth4lMLc"

describe("readLivePage", () => {
  it("membaca siaran yang sedang live", () => {
    const html = [
      `<link rel="canonical" href="https://www.youtube.com/watch?v=${videoId}">`,
      `"videoDetails":{"videoId":"${videoId}","title":"Night drive \\u0026 rain","lengthSeconds":"0","isLive":true`,
    ].join("\n")
    assert.deepEqual(readLivePage(html), { videoId, title: "Night drive & rain" })
  })

  it("mengabaikan channel yang tidak sedang live", () => {
    const html = [
      `<link rel="canonical" href="https://www.youtube.com/channel/${channelId}">`,
      `<meta property="og:title" content="Lofi Girl">`,
    ].join("\n")
    assert.equal(readLivePage(html), null)
    assert.equal(
      readLivePage(
        [
          `<link rel="canonical" href="https://www.youtube.com/watch?v=${videoId}">`,
          `"videoDetails":{"videoId":"${videoId}","title":"Replay","lengthSeconds":"120","isLive":false`,
        ].join("\n"),
      ),
      null,
    )
  })
})

describe("readChannelPage", () => {
  it("membaca id dan nama channel", () => {
    const html = [
      `<link rel="canonical" href="https://www.youtube.com/channel/${channelId}">`,
      `<meta property="og:title" content="Lofi Girl - YouTube">`,
      `"channelId":"UCsomeoneelse00000000000"`,
      `"externalId":"${channelId}"`,
    ].join("\n")
    assert.deepEqual(readChannelPage(html), { id: channelId, name: "Lofi Girl" })
  })
})
