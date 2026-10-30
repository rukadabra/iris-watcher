import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { aiModelListed, askAi } from "./ai-client"

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function fake(replies: Array<{ status: number; body: unknown }>): Array<Record<string, unknown>> {
  const sent: Array<Record<string, unknown>> = []
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>)
    const reply = replies.shift() ?? { status: 500, body: {} }
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }) as typeof fetch
  return sent
}

const base = { key: "k".repeat(20), system: "s", turns: [{ role: "user" as const, content: "hi" }], maxTokens: 100, timeoutMs: 5000 }
const geminiOk = { candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: "Hello" }] } }] }

test("reasoning off asks OpenRouter for no reasoning", async () => {
  const sent = fake([{ status: 200, body: { choices: [{ message: { content: "Hi" } }] } }])
  const result = await askAi({ ...base, provider: "openrouter", model: "a/b", reasoning: false })
  assert.deepEqual(result, { ok: true, text: "Hi" })
  assert.deepEqual(sent[0]?.reasoning, { effort: "none", exclude: true })
  assert.equal(sent[0]?.max_tokens, 100)
})

test("reasoning on gives the model room to think", async () => {
  const sent = fake([{ status: 200, body: { content: [{ type: "text", text: "Hi" }] } }])
  await askAi({ ...base, provider: "anthropic", model: "claude-x", reasoning: true })
  assert.deepEqual(sent[0]?.thinking, { type: "adaptive" })
  assert.equal(sent[0]?.max_tokens, 3100)
})

test("a rejected setting falls back once, then the working one is remembered", async () => {
  const sent = fake([
    { status: 400, body: { error: { message: "thinking level not supported" } } },
    { status: 200, body: geminiOk },
    { status: 200, body: geminiOk },
  ])
  const first = await askAi({ ...base, provider: "gemini", model: "gemini-fallback-test", reasoning: false })
  assert.deepEqual(first, { ok: true, text: "Hello" })
  const second = await askAi({ ...base, provider: "gemini", model: "gemini-fallback-test", reasoning: false })
  assert.equal(second.ok, true)
  assert.equal(sent.length, 3)
  const config = (body: Record<string, unknown> | undefined) => (body?.generationConfig as Record<string, unknown>).thinkingConfig
  assert.deepEqual(config(sent[0]), { thinkingLevel: "minimal" })
  assert.deepEqual(config(sent[1]), { thinkingLevel: "low" })
  assert.deepEqual(config(sent[2]), { thinkingLevel: "low" })
})

test("a rejected key stops without trying other settings", async () => {
  const sent = fake([{ status: 401, body: {} }])
  const result = await askAi({ ...base, provider: "openai", model: "gpt-x", reasoning: false })
  assert.deepEqual(result, { ok: false, reason: "key" })
  assert.equal(sent.length, 1)
})

test("OpenRouter accepts :nitro on a listed model", () => {
  assert.equal(aiModelListed("openrouter", "anthropic/claude-haiku-5.5:nitro", ["anthropic/claude-haiku-5.5"]), true)
  assert.equal(aiModelListed("openrouter", "anthropic/claude-haiku-5.5:turbo", ["anthropic/claude-haiku-5.5"]), false)
  assert.equal(aiModelListed("openai", "gpt-x:nitro", ["gpt-x"]), false)
})
