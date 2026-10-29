import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_WELCOME_MESSAGE, fillWelcome, parseWelcomeMessage, WELCOME_MESSAGE_MAX } from "./welcome"

describe("welcome", () => {
  it("fills the default message", () => {
    assert.equal(
      fillWelcome(null, { userId: "193344047895674880", name: "Lea", server: "Iris Lounge" }),
      "Welcome to **Iris Lounge**, <@193344047895674880>! We're glad you're here.",
    )
  })

  it("fills a custom message and keeps names plain", () => {
    assert.equal(
      fillWelcome("Hi {name}, say hello in {SERVER}. @everyone", { userId: "1", name: "*bold* @here", server: "A_B" }),
      "Hi \\*bold\\* @\u200bhere, say hello in A\\_B. @\u200beveryone",
    )
  })

  it("fills a boost message", () => {
    assert.equal(
      fillWelcome(null, { userId: "193344047895674880", name: "Lea", server: "Iris Lounge" }, "boost"),
      "Thank you for boosting **Iris Lounge**, <@193344047895674880>! 💜",
    )
    assert.equal(
      fillWelcome("{name} made it {boosts} boosts, level {level}", { userId: "1", name: "Lea", server: "S", boosts: 14, level: 2 }, "boost"),
      "Lea made it 14 boosts, level 2",
    )
  })

  it("checks the message length", () => {
    assert.deepEqual(parseWelcomeMessage("   "), { ok: true, message: null })
    assert.deepEqual(parseWelcomeMessage(" Hi {user} \r\n\r\n\r\nthere "), { ok: true, message: "Hi {user}\n\nthere" })
    assert.equal(parseWelcomeMessage("x".repeat(WELCOME_MESSAGE_MAX + 1)).ok, false)
    assert.ok(DEFAULT_WELCOME_MESSAGE.length <= WELCOME_MESSAGE_MAX)
  })
})
