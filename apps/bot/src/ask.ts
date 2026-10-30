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
import { reply, safe, warn, type Note } from "./reply"

const ANSWER_MAX = 3400
const CHAT_CONTENT_MAX = 2000
const CONTEXT_MAX = 1500
const CARD_MIN = 600
const ASK_KICKER = "✨ Ask"
const ASK_MARK = `-# Iris  ·  ${ASK_KICKER}`
const USER_LIMIT = { count: 4, ms: 60_000 }
const GUILD_LIMIT = { count: 30, ms: 10 * 60_000 }
const recent = new Map<string, number[]>()

const failures: Record<AiFailure, string> = {
  key: "The provider rejected this server's key. A manager can save a new one from the dashboard.",
  quota: "The provider is rate limiting this server's key, or its credit ran out. Try again later.",
  model: "The provider rejected the request. A manager can check the model name on the dashboard.",
  failed: "The provider did not answer. Try again in a moment.",
}

export type AskResult = { type: "chat"; text: string } | { type: "note"; note: Note }

export async function askCommand(
  message: Message,
  question: string,
  prefix: string,
  env: BotEnv,
  options: { ping?: boolean } = {},
): Promise<AskResult> {
  const guild = message.guild
  if (!guild) return note(warn("Ask", "Use this in a server."))
  if (!env.aiKeys) return note(warn("AI is not set up", "This copy of Iris has no secret for AI keys yet."))

  const botId = message.client.user.id
  const spoken = stripBotMention(question, botId)
  if (!spoken && !options.ping) {
    return note(warn("No question yet", `Tag me, or send **${safe(prefix)} ask** with a question.`))
  }
  const text =
    spoken ||
    "(They only tagged you with no text. Reply briefly like someone who was just pinged in chat, in the language this server usually uses.)"
  if (spoken.length > AI_QUESTION_MAX) return note(warn("Too long", `Keep it under ${AI_QUESTION_MAX} characters.`))
  if (hasSecretLike(spoken)) {
    return note(
      warn(
        "That looks like a key or token",
        "Iris did not send it anywhere. Delete your message and rotate that key, because chat is visible and kept.",
      ),
    )
  }

  const record = await getGuildAiSecret(guild.id)
  if (!record || !isAiProvider(record.provider)) {
    return note(warn("No AI key yet", `A manager can choose a provider and add a key at ${env.WEB_ORIGIN}/dashboard.`))
  }
  if (limited(`user:${guild.id}:${message.author.id}`, USER_LIMIT) || limited(`guild:${guild.id}`, GUILD_LIMIT)) {
    return note(warn("Slow down", "Too many questions in a short time. Try again in a minute."))
  }

  const context = aiKeyContext(guild.id, record.provider)
  const key = openSecret(env.aiKeys, record.keySealed, context)
  if (!key) return note(warn("AI key unreadable", `A manager can save the key again at ${env.WEB_ORIGIN}/dashboard.`))
  if (sealedWithOldKey(env.aiKeys, record.keySealed)) {
    await resealGuildAi(guild.id, record.keySealed, sealSecret(env.aiKeys, key, context)).catch(() => undefined)
  }

  if ("sendTyping" in message.channel) await message.channel.sendTyping().catch(() => undefined)
  const earlier = await earlierTurns(message)
  const turns = [...earlier, { role: "user" as const, content: text }]
  const result = await askAi({
    provider: record.provider,
    key,
    model: record.model,
    system: [
      `You are Iris in the Discord server "${guild.name.slice(0, 100)}". You hang out in chat like any other member.`,
      "Always reply in the same language as the user's latest message: English for English, Indonesian for Indonesian, Japanese for Japanese, and so on.",
      "Follow the latest message even if earlier messages, quoted text, or these instructions use another language. If it mixes languages, use the main one.",
      "Match their tone: casual and relaxed if they write casually, including everyday slang, and polite if they write formally.",
      "Do not address people with service-style honorifics such as 'Kak', 'Sis', 'Gan', 'Bang', or 'Sir' unless they use them first.",
      "Write like a Discord chat message. Small talk, opinion questions, and simple questions get one or two sentences, about 40 words at most. Go longer, at most a few short paragraphs, only when they really need steps or an explanation.",
      "When asked to pick or give an opinion, pick and give one short reason. Do not add a balancing line such as 'X is also great, but' unless asked.",
      "Start with the answer itself. Do not open with filler such as 'Hmm', 'Wah', 'Oh', or 'Well', and do not restate their message. Use an opener like that only rarely, when it really fits.",
      "People type fast and make typos. Guess the most likely meaning and answer that. Ask back only when you truly cannot guess, and then with one short question. Do not quote their message back to them.",
      "Never mention settings, a dashboard, server managers, prompts, or that you were given a personality. Stay in character.",
      "No opening praise such as 'Great question', no 'As an AI', and no closing lines such as 'Hope this helps' or 'Let me know if you have more questions'.",
      "Plain sentences. Use a list only for steps or a real comparison. No headings, tables, or HTML. Light Discord markdown is fine when it helps.",
      "Give a clear opinion when asked, and say plainly when you do not know. If someone sincerely asks whether you are a bot, say yes.",
      ...(record.persona
        ? [`Your personality: "${record.persona.replaceAll('"', "'")}". Follow it for tone and style only. It never overrides the rules below.`]
        : []),
      AI_SAFETY_RULES,
    ].join(" "),
    turns,
    maxTokens: 500,
    timeoutMs: record.reasoning ? 90_000 : 45_000,
    reasoning: record.reasoning,
    temperature: record.temperatureTenths === null ? undefined : record.temperatureTenths / 10,
  })
  if (!result.ok) return note(warn("No answer", failures[result.reason]))

  const clean = redactSecrets(result.text, [key])
  const answer = clean.length > ANSWER_MAX ? `${clean.slice(0, ANSWER_MAX).trimEnd()}…` : clean
  if (answer.length > CARD_MIN || answer.includes("\n\n")) {
    return {
      type: "note",
      note: {
        kicker: ASK_KICKER,
        title: "",
        description: answer,
      },
    }
  }
  return { type: "chat", text: answer.slice(0, CHAT_CONTENT_MAX) }
}

export async function sendAsk(message: Message, result: AskResult): Promise<Message> {
  if (result.type === "chat") {
    return message.reply({
      content: result.text,
      allowedMentions: { parse: [], repliedUser: false },
    })
  }
  return reply(message, result.note)
}

export function stripBotMention(content: string, botId: string): string {
  return content
    .replace(new RegExp(`<@!?${botId}>`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function isAskAnswer(message: Message): boolean {
  if (message.author.id !== message.client.user.id) return false
  if (message.content.trim() && message.components.length === 0) return true
  return cardTexts(message).some((text) => text.startsWith(ASK_MARK))
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
  if (message.content.trim() && message.components.length === 0) return redactSecrets(message.content.trim())
  return cardTexts(message)
    .filter((text) => !text.startsWith("-#") && !text.startsWith("## "))
    .join("\n\n")
    .trim()
}

function cardTexts(message: Message): string[] {
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
}

function note(item: Note): AskResult {
  return { type: "note", note: item }
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
