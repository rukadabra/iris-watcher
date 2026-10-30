import type { AiProvider } from "./ai"

export type AiTurn = { role: "user" | "assistant"; content: string }
export type AiFailure = "key" | "quota" | "model" | "failed"
export type AiAnswer = { ok: true; text: string; action?: AiAction } | { ok: false; reason: AiFailure }
export type AiAction = { name: string; args: Record<string, unknown> }
export type AiTool = {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, { type: "string" | "boolean"; description: string }>
    required?: string[]
  }
}
export type AiModels = { ok: true; models: string[] } | { ok: false; reason: AiFailure }

const OPENAI_STYLE: Partial<Record<AiProvider, string>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com",
  xai: "https://api.x.ai/v1",
}
const ANTHROPIC = "https://api.anthropic.com/v1"
const GEMINI = "https://generativelanguage.googleapis.com/v1beta"
const LIST_MS = 10_000

export async function listAiModels(provider: AiProvider, key: string): Promise<AiModels> {
  try {
    if (provider === "anthropic") {
      const body = await call(`${ANTHROPIC}/models?limit=1000`, anthropicHeaders(key), LIST_MS)
      if (!body.ok) return body
      return { ok: true, models: ids(body.json, "data", "id") }
    }
    if (provider === "gemini") {
      const body = await call(`${GEMINI}/models?pageSize=1000`, { "x-goog-api-key": key }, LIST_MS)
      if (!body.ok) return body
      const models = (record(body.json).models as unknown[] | undefined) ?? []
      return {
        ok: true,
        models: models.flatMap((item) => {
          const model = record(item)
          const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : []
          return typeof model.name === "string" && methods.includes("generateContent") ? [model.name.replace(/^models\//, "")] : []
        }),
      }
    }
    const base = OPENAI_STYLE[provider]
    if (!base) return { ok: false, reason: "failed" }
    if (provider === "openrouter") {
      const checked = await call(`${base}/key`, bearer(key), LIST_MS)
      if (!checked.ok) return checked
      const listed = await call(`${base}/models`, {}, LIST_MS)
      if (!listed.ok) return listed
      return { ok: true, models: ids(listed.json, "data", "id") }
    }
    const body = await call(`${base}/models`, bearer(key), LIST_MS)
    if (!body.ok) return body
    return { ok: true, models: ids(body.json, "data", "id") }
  } catch {
    return { ok: false, reason: "failed" }
  }
}

export async function askAi(input: {
  provider: AiProvider
  key: string
  model: string
  system: string
  turns: AiTurn[]
  maxTokens: number
  timeoutMs: number
  reasoning: boolean
  temperature?: number
  tools?: AiTool[]
}): Promise<AiAnswer> {
  const model = `${input.provider}|${input.model}`
  const tools = input.tools?.length && !refusesTools.has(model) ? input.tools : undefined
  const first = await askVariants({ ...input, tools })
  if (!tools || first.ok || first.reason !== "model") return first
  const bare = await askVariants({ ...input, tools: undefined })
  if (bare.ok) refusesTools.add(model)
  return bare
}

async function askVariants(input: AskInput): Promise<AiAnswer> {
  const variants = reasoningVariants(input.provider, input.reasoning)
  const model = `${input.provider}|${input.model}`
  const memo = `${model}|${input.reasoning ? "on" : "off"}`
  const start = Math.min(workingVariant.get(memo) ?? 0, variants.length - 1)
  const plain = { ...input, temperature: undefined }
  const tuned = input.temperature !== undefined && !refusesTemperature.has(model) ? input : plain
  let last: AiAnswer = { ok: false, reason: "failed" }
  for (let index = start; index < variants.length; index += 1) {
    const variant = variants[index] as Variant
    last = await askOnce(tuned, variant)
    if (!last.ok && last.reason === "model" && tuned !== plain && !variant.thinks) {
      last = await askOnce(plain, variant)
      if (last.ok) refusesTemperature.add(model)
    }
    if (last.ok || last.reason !== "model") {
      if (last.ok) workingVariant.set(memo, index)
      return last
    }
  }
  return last
}

type AskInput = {
  provider: AiProvider
  key: string
  model: string
  system: string
  turns: AiTurn[]
  maxTokens: number
  timeoutMs: number
  reasoning: boolean
  temperature?: number
  tools?: AiTool[]
}

type Variant = { params: Record<string, unknown>; thinks: boolean }

const THINKING_ROOM = 3000
const workingVariant = new Map<string, number>()
const refusesTemperature = new Set<string>()
const refusesTools = new Set<string>()

function reasoningVariants(provider: AiProvider, reasoning: boolean): Variant[] {
  const plain = { params: {}, thinks: true }
  const off = (params: Record<string, unknown>) => ({ params, thinks: false })
  const on = (params: Record<string, unknown>) => ({ params, thinks: true })
  switch (provider) {
    case "openrouter":
      return reasoning
        ? [on({ reasoning: { effort: "medium", exclude: true } }), plain]
        : [off({ reasoning: { effort: "none", exclude: true } }), on({ reasoning: { effort: "low", exclude: true } }), plain]
    case "openai":
      return reasoning
        ? [on({ reasoning_effort: "medium" }), plain]
        : [off({ reasoning_effort: "none" }), off({ reasoning_effort: "minimal" }), on({ reasoning_effort: "low" }), plain]
    case "anthropic":
      return reasoning
        ? [on({ thinking: { type: "adaptive" } }), on({ thinking: { type: "enabled", budget_tokens: 1024 } }), plain]
        : [off({ thinking: { type: "disabled" } }), plain]
    case "gemini":
      return reasoning
        ? [on({ thinkingConfig: { thinkingLevel: "medium" } }), plain]
        : [
            off({ thinkingConfig: { thinkingLevel: "minimal" } }),
            on({ thinkingConfig: { thinkingLevel: "low" } }),
            off({ thinkingConfig: { thinkingBudget: 0 } }),
            plain,
          ]
    default:
      return reasoning ? [plain] : [off({ reasoning_effort: "none" }), plain]
  }
}

async function askOnce(input: AskInput, variant: Variant): Promise<AiAnswer> {
  const { provider, key, model, system, turns, timeoutMs, tools } = input
  const maxTokens = variant.thinks ? input.maxTokens + THINKING_ROOM : input.maxTokens
  const temperature = !variant.thinks && input.temperature !== undefined ? { temperature: input.temperature } : {}
  try {
    if (provider === "anthropic") {
      const body = await call(`${ANTHROPIC}/messages`, anthropicHeaders(key), timeoutMs, {
        model,
        max_tokens: maxTokens,
        system,
        messages: turns,
        ...(tools ? { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}),
        ...temperature,
        ...variant.params,
      })
      if (!body.ok) return body
      const parts = ((record(body.json).content as unknown[] | undefined) ?? []).map(record)
      const used = parts.find((part) => part.type === "tool_use")
      return answer(
        parts.map((part) => (part.type === "text" ? String(part.text ?? "") : "")).join(""),
        used ? action(used.name, used.input) : undefined,
      )
    }
    if (provider === "gemini") {
      const body = await call(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key }, timeoutMs, {
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content }] })),
        ...(tools
          ? {
              tools: [
                {
                  functionDeclarations: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    ...(Object.keys(tool.parameters.properties).length ? { parameters: tool.parameters } : {}),
                  })),
                },
              ],
            }
          : {}),
        generationConfig: { maxOutputTokens: maxTokens, ...temperature, ...variant.params },
      })
      if (!body.ok) return body
      const candidate = record(((record(body.json).candidates as unknown[] | undefined) ?? [])[0])
      const parts = ((record(candidate.content).parts as unknown[] | undefined) ?? []).map(record)
      const used = parts.map((part) => record(part.functionCall)).find((called) => typeof called.name === "string")
      return answer(
        parts.map((part) => (part.thought ? "" : String(part.text ?? ""))).join(""),
        used ? action(used.name, used.args) : undefined,
      )
    }
    const base = OPENAI_STYLE[provider]
    if (!base) return { ok: false, reason: "failed" }
    const body = await call(`${base}/chat/completions`, bearer(key), timeoutMs, {
      model,
      messages: [{ role: "system", content: system }, ...turns],
      ...(provider === "openai" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      ...(tools ? { tools: tools.map((tool) => ({ type: "function", function: tool })) } : {}),
      ...temperature,
      ...variant.params,
    })
    if (!body.ok) return body
    const message = record(record(((record(body.json).choices as unknown[] | undefined) ?? [])[0]).message)
    const called = record(record(((message.tool_calls as unknown[] | undefined) ?? [])[0]).function)
    return answer(String(message.content ?? ""), typeof called.name === "string" ? action(called.name, parseArgs(called.arguments)) : undefined)
  } catch {
    return { ok: false, reason: "failed" }
  }
}

export function aiModelListed(provider: AiProvider, model: string, models: readonly string[]): boolean {
  const base = provider === "openrouter" ? model.replace(/:nitro$/, "") : model
  return models.includes(base)
}

async function call(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  payload?: unknown,
): Promise<{ ok: true; json: unknown } | { ok: false; reason: AiFailure }> {
  const response = await fetch(url, {
    method: payload === undefined ? "GET" : "POST",
    headers: { accept: "application/json", ...(payload === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    if (response.status === 400) {
      const detail = (await response.text().catch(() => "")).slice(0, 4000)
      if (/api[\s_-]?key/i.test(detail)) return { ok: false, reason: "key" }
    } else {
      await response.body?.cancel()
    }
    return { ok: false, reason: failure(response.status) }
  }
  return { ok: true, json: await response.json() }
}

function failure(status: number): AiFailure {
  if (status === 401 || status === 403) return "key"
  if (status === 402 || status === 429) return "quota"
  if (status === 400 || status === 404 || status === 422) return "model"
  return "failed"
}

function answer(text: string, used?: AiAction): AiAnswer {
  const trimmed = text.trim()
  if (used) return { ok: true, text: trimmed, action: used }
  return trimmed ? { ok: true, text: trimmed } : { ok: false, reason: "failed" }
}

function action(name: unknown, args: unknown): AiAction | undefined {
  return typeof name === "string" ? { name, args: record(args) } : undefined
}

function parseArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function bearer(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` }
}

function anthropicHeaders(key: string): Record<string, string> {
  return { "x-api-key": key, "anthropic-version": "2023-06-01" }
}

function ids(json: unknown, list: string, field: string): string[] {
  const items = record(json)[list]
  if (!Array.isArray(items)) return []
  return items.flatMap((item) => {
    const value = record(item)[field]
    return typeof value === "string" ? [value] : []
  })
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}
