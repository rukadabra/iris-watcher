export const AI_PROVIDERS = ["openai", "anthropic", "gemini", "openrouter", "groq", "mistral", "deepseek", "xai"] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const aiProviders: Record<AiProvider, { label: string; example: string; keyUrl: string }> = {
  openai: { label: "OpenAI", example: "gpt-6.1-terra", keyUrl: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic", example: "claude-haiku-5.5", keyUrl: "https://console.anthropic.com/settings/keys" },
  gemini: { label: "Google Gemini", example: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey" },
  openrouter: { label: "OpenRouter", example: "google/gemini-3.8-flash", keyUrl: "https://openrouter.ai/keys" },
  groq: { label: "Groq", example: "llama-3.3-70b-versatile", keyUrl: "https://console.groq.com/keys" },
  mistral: { label: "Mistral", example: "mistral-small-latest", keyUrl: "https://console.mistral.ai/api-keys" },
  deepseek: { label: "DeepSeek", example: "deepseek-chat", keyUrl: "https://platform.deepseek.com/api_keys" },
  xai: { label: "xAI", example: "grok-4.7", keyUrl: "https://console.x.ai" },
}

export const AI_QUESTION_MAX = 1500
export const AI_PERSONA_MAX = 300

export type AiTemperatureGuide = { max: number; normal: string; advice: string; caveat: string }

export const aiTemperature: Record<AiProvider, AiTemperatureGuide> = {
  openai: {
    max: 2,
    normal: "1.0",
    advice: "0.7 to 1.0 for chat.",
    caveat: "GPT-6 models take it only while reasoning is off. GPT-6.1 Sol and GPT-6 Astra never take it.",
  },
  anthropic: {
    max: 1,
    normal: "1.0",
    advice: "Leave it on the default.",
    caveat: "Claude Haiku 5.5, Sonnet 5, Opus 4.7, and newer refuse any custom value. Older models such as Claude Haiku 4.5 take 0 to 1 while reasoning is off.",
  },
  gemini: {
    max: 2,
    normal: "1.0",
    advice: "Keep 1.0 for Gemini 3.",
    caveat: "Google warns that values below 1.0 can make Gemini 3 loop or answer worse. Gemini 2.5 models take 0 to 2.",
  },
  openrouter: {
    max: 2,
    normal: "1.0",
    advice: "Follow the advice for the model's own provider.",
    caveat: "OpenRouter passes the value on. A model that refuses it, such as a recent Claude, answers with its default.",
  },
  groq: {
    max: 2,
    normal: "1.0",
    advice: "0.6 to 1.0 for chat.",
    caveat: "Most open models on Groq take it.",
  },
  mistral: {
    max: 1,
    normal: "set per model",
    advice: "Mistral recommends 0 to 0.7.",
    caveat: "Above 0.7, answers get random quickly.",
  },
  deepseek: {
    max: 2,
    normal: "1.0",
    advice: "DeepSeek recommends 1.3 for conversation, 1.5 for creative writing, and 0 for code and math.",
    caveat: "Reasoning models ignore it.",
  },
  xai: {
    max: 2,
    normal: "1.0",
    advice: "0.7 to 1.0 for chat.",
    caveat: "Some Grok reasoning models may refuse it.",
  },
}

export function parseAiTemperature(
  raw: string,
  provider: AiProvider,
): { ok: true; tenths: number | null } | { ok: false; error: string } {
  const text = raw.trim()
  if (!text) return { ok: true, tenths: null }
  const value = Number(text)
  const max = aiTemperature[provider].max
  if (!Number.isFinite(value) || value < 0 || value > max) {
    return { ok: false, error: `Use a temperature from 0 to ${max}, or leave it empty for the default.` }
  }
  const tenths = Math.round(value * 10)
  if (Math.abs(value * 10 - tenths) > 1e-6) return { ok: false, error: "Use one decimal at most, such as 0.7." }
  return { ok: true, tenths }
}

export function parseAiPersona(raw: string): { ok: true; persona: string } | { ok: false; error: string } {
  const persona = raw
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (persona.length > AI_PERSONA_MAX) return { ok: false, error: `Keep the personality under ${AI_PERSONA_MAX} characters.` }
  return { ok: true, persona }
}

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value)
}

export function parseAiKey(raw: string): { ok: true; key: string } | { ok: false; error: string } {
  const key = raw.trim()
  if (!/^[\x21-\x7e]{16,400}$/.test(key)) return { ok: false, error: "That key does not look like an API key." }
  return { ok: true, key }
}

export function parseAiModel(raw: string): { ok: true; model: string } | { ok: false; error: string } {
  const model = raw.trim().replace(/^models\//, "")
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/.test(model)) return { ok: false, error: "Enter a model name, such as the example." }
  return { ok: true, model }
}

export function aiKeyHint(key: string): string {
  return key.slice(-4)
}

export function aiKeyContext(guildId: string, provider: AiProvider): string {
  return `ai-key:${guildId}:${provider}`
}
