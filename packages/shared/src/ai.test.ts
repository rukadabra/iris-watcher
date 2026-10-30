import assert from "node:assert/strict"
import { test } from "node:test"
import { AI_PERSONA_MAX, parseAiPersona, parseAiTemperature, parseAiTimeZone } from "./ai"

test("temperature is stored in tenths and empty means the default", () => {
  assert.deepEqual(parseAiTemperature("", "gemini"), { ok: true, tenths: null })
  assert.deepEqual(parseAiTemperature("0.7", "openai"), { ok: true, tenths: 7 })
  assert.deepEqual(parseAiTemperature("2", "deepseek"), { ok: true, tenths: 20 })
  assert.deepEqual(parseAiTemperature("0", "mistral"), { ok: true, tenths: 0 })
})

test("temperature outside the provider's range or with two decimals is rejected", () => {
  assert.equal(parseAiTemperature("1.5", "anthropic").ok, false)
  assert.equal(parseAiTemperature("2.1", "openai").ok, false)
  assert.equal(parseAiTemperature("-0.1", "groq").ok, false)
  assert.equal(parseAiTemperature("0.75", "groq").ok, false)
  assert.equal(parseAiTemperature("hot", "groq").ok, false)
})

test("a personality is flattened to one clean line", () => {
  assert.deepEqual(parseAiPersona("  playful,\n\tloves  anime\u0000 "), { ok: true, persona: "playful, loves anime" })
  assert.deepEqual(parseAiPersona(""), { ok: true, persona: "" })
})

test("a personality over the limit is rejected", () => {
  assert.equal(parseAiPersona("a".repeat(AI_PERSONA_MAX)).ok, true)
  assert.equal(parseAiPersona("a".repeat(AI_PERSONA_MAX + 1)).ok, false)
})

test("a time zone must be a real IANA zone", () => {
  assert.deepEqual(parseAiTimeZone(""), { ok: true, timeZone: null })
  assert.deepEqual(parseAiTimeZone("Asia/Jakarta"), { ok: true, timeZone: "Asia/Jakarta" })
  assert.equal(parseAiTimeZone("Mars/Olympus").ok, false)
})