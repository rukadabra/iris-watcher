import assert from "node:assert/strict"
import { test } from "node:test"
import { AI_HIDDEN, hasSecretLike, redactSecrets } from "./ai-guard"

const samples = [
  `sk-proj-${"a1B2".repeat(10)}`,
  `sk-ant-api03-${"x".repeat(40)}`,
  `sk-or-v1-${"f".repeat(64)}`,
  `AIza${"Sy".repeat(18)}`,
  `gsk_${"Q".repeat(40)}`,
  `xai-${"z".repeat(40)}`,
  `ghp_${"k".repeat(36)}`,
  "AKIAABCDEFGHIJKLMNOP",
  `MTA${"x".repeat(21)}.Gabcde.${"y".repeat(38)}`,
]

test("keys and tokens are recognised in a question", () => {
  for (const sample of samples) assert.equal(hasSecretLike(`my key is ${sample} ok?`), true, sample)
})

test("ordinary questions pass", () => {
  for (const text of ["why is the sky blue", "what is sk-learn", "explain AIza in one line", "use the key ABC-123"]) {
    assert.equal(hasSecretLike(text), false, text)
  }
})

test("answers lose keys, including the server's own key in any case", () => {
  const own = "custom-provider-key-0123456789"
  const answer = `Here: ${samples[0]} and ${own.toUpperCase()}.`
  const clean = redactSecrets(answer, [own])
  assert.equal(clean, `Here: ${AI_HIDDEN} and ${AI_HIDDEN}.`)
})
