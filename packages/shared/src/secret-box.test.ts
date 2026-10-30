import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { aiKeyContext, parseAiKey, parseAiModel } from "./ai"
import { loadSecretRing, openSecret, sealedWithOldKey, sealSecret, type SecretRing } from "./secret-box"

function ring(current = randomBytes(32).toString("base64"), previous?: string): SecretRing {
  const loaded = loadSecretRing(current, previous)
  assert.ok(loaded.ok && loaded.ring)
  return loaded.ring
}

const context = aiKeyContext("476307859819200513", "gemini")
const secret = "AIzaSyExample-not-a-real-key-1234"

test("a sealed key opens with the same ring and context", () => {
  const keys = ring()
  const sealed = sealSecret(keys, secret, context)
  assert.equal(openSecret(keys, sealed, context), secret)
  assert.ok(!sealed.includes(secret))
})

test("every seal uses a fresh IV", () => {
  const keys = ring()
  assert.notEqual(sealSecret(keys, secret, context), sealSecret(keys, secret, context))
})

test("a sealed key does not open for another server or provider", () => {
  const keys = ring()
  const sealed = sealSecret(keys, secret, context)
  assert.equal(openSecret(keys, sealed, aiKeyContext("476307859819200514", "gemini")), null)
  assert.equal(openSecret(keys, sealed, aiKeyContext("476307859819200513", "openai")), null)
})

test("a changed byte anywhere is rejected", () => {
  const keys = ring()
  const sealed = sealSecret(keys, secret, context)
  const parts = sealed.split(".")
  for (const index of [2, 3, 4]) {
    const part = parts[index] ?? ""
    const flipped = (part[0] === "A" ? "B" : "A") + part.slice(1)
    const changed = parts.map((value, at) => (at === index ? flipped : value)).join(".")
    assert.equal(openSecret(keys, changed, context), null)
  }
  assert.equal(openSecret(keys, sealed.slice(0, -2), context), null)
})

test("another master secret cannot open it", () => {
  const sealed = sealSecret(ring(), secret, context)
  assert.equal(openSecret(ring(), sealed, context), null)
})

test("the previous secret still opens old keys after rotation", () => {
  const oldSecret = randomBytes(32).toString("base64")
  const before = ring(oldSecret)
  const sealed = sealSecret(before, secret, context)
  const after = ring(randomBytes(32).toString("base64"), oldSecret)
  assert.equal(openSecret(after, sealed, context), secret)
  assert.ok(sealedWithOldKey(after, sealed))
  assert.ok(!sealedWithOldKey(after, sealSecret(after, secret, context)))
})

test("master secrets must be exactly 32 bytes of base64", () => {
  assert.deepEqual(loadSecretRing(undefined), { ok: true, ring: null })
  assert.equal(loadSecretRing("hunter2").ok, false)
  assert.equal(loadSecretRing(randomBytes(16).toString("base64")).ok, false)
  assert.equal(loadSecretRing(randomBytes(32).toString("base64url")).ok, true)
  const same = randomBytes(32).toString("base64")
  assert.equal(loadSecretRing(same, same).ok, false)
  assert.equal(loadSecretRing(undefined, same).ok, false)
})

test("keys and models are checked before they are stored", () => {
  assert.equal(parseAiKey("  sk-or-v1-abcdefghijklmnop  ").ok, true)
  assert.equal(parseAiKey("short").ok, false)
  assert.equal(parseAiKey("has space inside the key value").ok, false)
  assert.deepEqual(parseAiModel("models/gemini-3.8-flash"), { ok: true, model: "gemini-3.8-flash" })
  assert.deepEqual(parseAiModel("google/gemini-3.8-flash:free"), { ok: true, model: "google/gemini-3.8-flash:free" })
  assert.equal(parseAiModel("../../etc").ok, false)
  assert.equal(parseAiModel("").ok, false)
})
