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
