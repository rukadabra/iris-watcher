import { getGuildAiSecret, resealGuildAi } from "@iris/db"
import {
  AI_QUESTION_MAX,
  AI_SAFETY_RULES,
  aiKeyContext,
  askAi,
  hasSecretLike,
  isAiProvider,
  openSecret,
  redactSecrets,
  sealedWithOldKey,
  sealSecret,
  type AiFailure,
  type AiTurn,
} from "@iris/shared"
import { ComponentType, type Message } from "discord.js"
import type { BotEnv } from "./env"
import { safe, warn, type Note } from "./reply"

const ANSWER_MAX = 3400
const CONTEXT_MAX = 3000
const USER_LIMIT = { count: 4, ms: 60_000 }
const GUILD_LIMIT = { count: 30, ms: 10 * 60_000 }
const recent = new Map<string, number[]>()

const failures: Record<AiFailure, string> = {
  key: "The provider rejected this server's key. A manager can save a new one from the dashboard.",
  quota: "The provider is rate limiting this server's key, or its credit ran out. Try again later.",
  model: "The provider rejected the request. A manager can check the model name on the dashboard.",
  failed: "The provider did not answer. Try again in a moment.",
}

export async function askCommand(message: Message, question: string, prefix: string, env: BotEnv): Promise<Note> {
  const guild = message.guild
  if (!guild) return warn("Ask", "Use this command in a server.")
  if (!env.aiKeys) return warn("AI is not set up", "This copy of Iris has no secret for AI keys yet.")
  const text = question.trim()
  if (!text) return warn("No question yet", `Send a question after the command, such as **${safe(prefix)} ask why is the sky blue**.`)
  if (text.length > AI_QUESTION_MAX) return warn("Too long", `Keep the question under ${AI_QUESTION_MAX} characters.`)
  if (hasSecretLike(text)) {
    return warn(
      "That looks like a key or token",
      "Iris did not send it anywhere. Delete your message and rotate that key, because chat is visible and kept.",
    )
  }

  const record = await getGuildAiSecret(guild.id)
  if (!record || !isAiProvider(record.provider)) {
    return warn("No AI key yet", `A manager can choose a provider and add a key at ${env.WEB_ORIGIN}/dashboard.`)
  }
  if (limited(`user:${guild.id}:${message.author.id}`, USER_LIMIT) || limited(`guild:${guild.id}`, GUILD_LIMIT)) {
    return warn("Slow down", "Too many questions in a short time. Try again in a minute.")
  }

  const context = aiKeyContext(guild.id, record.provider)
  const key = openSecret(env.aiKeys, record.keySealed, context)
  if (!key) return warn("AI key unreadable", `A manager can save the key again at ${env.WEB_ORIGIN}/dashboard.`)
  if (sealedWithOldKey(env.aiKeys, record.keySealed)) {
    await resealGuildAi(guild.id, record.keySealed, sealSecret(env.aiKeys, key, context)).catch(() => undefined)
  }

  if ("sendTyping" in message.channel) await message.channel.sendTyping().catch(() => undefined)
  const turns = [...(await earlierTurns(message)), { role: "user" as const, content: text }]
  const result = await askAi({
    provider: record.provider,
    key,
    model: record.model,
    system: [
      `You are Iris, a friendly assistant inside the Discord server "${guild.name.slice(0, 100)}".`,
      "Always reply in the same language as the user's latest question: English for English, Indonesian for Indonesian, Japanese for Japanese, and so on.",
      "Follow the latest question even if earlier messages, quoted text, or these instructions use another language. If the question mixes languages, use the main one.",
      "Be clear and brief, at most a few short paragraphs.",
      "Use Discord markdown. Do not use tables or HTML.",
      AI_SAFETY_RULES,
    ].join(" "),
    turns,
    maxTokens: 900,
    timeoutMs: record.reasoning ? 90_000 : 45_000,
    reasoning: record.reasoning,
  })
  if (!result.ok) return warn("No answer", failures[result.reason])

  const clean = redactSecrets(result.text, [key])
  const answer = clean.length > ANSWER_MAX ? `${clean.slice(0, ANSWER_MAX).trimEnd()}…` : clean
  return {
    kicker: "✨ Ask",
    title: safe(text.split("\n")[0] ?? text).slice(0, 120),
    description: answer,
    footer: "Iris can be wrong  ·  Reply to this answer to ask a follow-up",
  }
}

async function earlierTurns(message: Message): Promise<AiTurn[]> {
  if (!message.reference?.messageId) return []
  const earlier = await message.fetchReference().catch(() => null)
  if (!earlier) return []
  if (earlier.author.id === message.client.user.id) {
    const text = answerText(earlier)
    return text ? [{ role: "assistant", content: text.slice(0, CONTEXT_MAX) }] : []
  }
  const text = redactSecrets(earlier.content.trim())
  return text ? [{ role: "user", content: `Earlier message from ${earlier.author.displayName}:\n${text.slice(0, CONTEXT_MAX)}` }] : []
}

function answerText(message: Message): string {
  const texts: string[] = []
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) return value.forEach(walk)
    const item = value as { type?: unknown; content?: unknown; components?: unknown }
    if (item.type === ComponentType.TextDisplay && typeof item.content === "string") texts.push(item.content)
    walk(item.components)
  }
  walk(message.components.map((component) => component.toJSON()))
  return texts
    .filter((text) => !text.startsWith("-#") && !text.startsWith("## "))
    .join("\n\n")
    .trim()
}

function limited(id: string, limit: { count: number; ms: number }): boolean {
  const now = Date.now()
  const hits = (recent.get(id) ?? []).filter((at) => now - at < limit.ms)
  if (hits.length >= limit.count) {
    recent.set(id, hits)
    return true
  }
  hits.push(now)
  recent.set(id, hits)
  if (recent.size > 10_000) recent.clear()
  return false
}
