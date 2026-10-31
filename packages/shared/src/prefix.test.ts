import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseCommand, parseCustomPrefix } from "./prefix"

describe("parseCommand", () => {
  it("reads a command after the default prefix", () => {
    assert.deepEqual(parseCommand("!iris help", "!iris"), { name: "help", args: [] })
    assert.deepEqual(parseCommand("!iris ping now", "!iris"), { name: "ping", args: ["now"] })
  })

  it("ignores a prefix attached to a word", () => {
    assert.equal(parseCommand("!irishelp", "!iris"), null)
    assert.equal(parseCommand("!iris", "!iris"), null)
  })

  it("lowercases the command name", () => {
    assert.deepEqual(parseCommand("!iris HELP", "!iris"), { name: "help", args: [] })
  })

  it("allows an attached command when the prefix ends with a symbol", () => {
    assert.deepEqual(parseCommand("!help", "!"), { name: "help", args: [] })
    assert.deepEqual(parseCommand("! help", "!"), { name: "help", args: [] })
  })

  it("respects a server's custom prefix", () => {
    assert.deepEqual(parseCommand("? ping", "?"), { name: "ping", args: [] })
    assert.equal(parseCommand("!iris ping", "?"), null)
  })
})

describe("parseCustomPrefix", () => {
  it("accepts the default prefix and a short symbol", () => {
    assert.deepEqual(parseCustomPrefix("!iris"), { ok: true, prefix: "!iris" })
    assert.deepEqual(parseCustomPrefix("!"), { ok: true, prefix: "!" })
  })

  it("rejects spaces, mentions, and an empty string", () => {
    assert.equal(parseCustomPrefix("! iris").ok, false)
    assert.equal(parseCustomPrefix("@iris").ok, false)
    assert.equal(parseCustomPrefix("<@123>").ok, false)
    assert.equal(parseCustomPrefix("").ok, false)
    assert.equal(parseCustomPrefix("prefixtoolong").ok, false)
  })
})
