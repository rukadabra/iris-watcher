import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseCommand, parseCustomPrefix } from "./prefix"

describe("parseCommand", () => {
  it("membaca perintah setelah prefix bawaan", () => {
    assert.deepEqual(parseCommand("!iris help", "!iris"), { name: "help", args: [] })
    assert.deepEqual(parseCommand("!iris ping now", "!iris"), { name: "ping", args: ["now"] })
  })

  it("mengabaikan prefix yang menempel pada kata", () => {
    assert.equal(parseCommand("!irishelp", "!iris"), null)
    assert.equal(parseCommand("!iris", "!iris"), null)
  })

  it("mengubah nama perintah menjadi huruf kecil", () => {
    assert.deepEqual(parseCommand("!iris HELP", "!iris"), { name: "help", args: [] })
  })

  it("mengizinkan perintah menempel bila prefix diakhiri simbol", () => {
    assert.deepEqual(parseCommand("!help", "!"), { name: "help", args: [] })
    assert.deepEqual(parseCommand("! help", "!"), { name: "help", args: [] })
  })

  it("menghormati prefix khusus server", () => {
    assert.deepEqual(parseCommand("? ping", "?"), { name: "ping", args: [] })
    assert.equal(parseCommand("!iris ping", "?"), null)
  })
})

describe("parseCustomPrefix", () => {
  it("menerima prefix bawaan dan simbol pendek", () => {
    assert.deepEqual(parseCustomPrefix("!iris"), { ok: true, prefix: "!iris" })
    assert.deepEqual(parseCustomPrefix("!"), { ok: true, prefix: "!" })
  })

  it("menolak spasi, mention, dan string kosong", () => {
    assert.equal(parseCustomPrefix("! iris").ok, false)
    assert.equal(parseCustomPrefix("@iris").ok, false)
    assert.equal(parseCustomPrefix("<@123>").ok, false)
    assert.equal(parseCustomPrefix("").ok, false)
    assert.equal(parseCustomPrefix("prefixterlalu").ok, false)
  })
})
