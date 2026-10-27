import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isToggleableCommand, sanitizeDisabledCommands } from "./commands"

describe("command switches", () => {
  it("keeps help and prefix on", () => {
    assert.equal(isToggleableCommand("help"), false)
    assert.equal(isToggleableCommand("prefix"), false)
    assert.equal(isToggleableCommand("play"), true)
    assert.equal(isToggleableCommand("nope"), false)
  })

  it("drops unknown names and duplicates", () => {
    assert.deepEqual(sanitizeDisabledCommands(["play", "help", "play", "skip", "nope"]), ["play", "skip"])
  })
})
