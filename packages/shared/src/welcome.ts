export const GREETING_KINDS = ["welcome", "boost"] as const
export type GreetingKind = (typeof GREETING_KINDS)[number]

export const WELCOME_MESSAGE_MAX = 300
export const DEFAULT_WELCOME_MESSAGE = "Welcome to **{server}**, {user}! We're glad you're here."
export const DEFAULT_BOOST_MESSAGE = "Thank you for boosting **{server}**, {user}! 💜"

export const greetingDefaults: Record<GreetingKind, string> = {
  welcome: DEFAULT_WELCOME_MESSAGE,
  boost: DEFAULT_BOOST_MESSAGE,
}

export function isGreetingKind(value: string): value is GreetingKind {
  return (GREETING_KINDS as readonly string[]).includes(value)
}

export type WelcomeFill = {
  userId: string
  name: string
  server: string
  boosts?: number
  level?: number
}

export function parseWelcomeMessage(raw: string): { ok: true; message: string | null } | { ok: false; error: string } {
  const message = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (!message) return { ok: true, message: null }
  if (message.length > WELCOME_MESSAGE_MAX) {
    return { ok: false, error: `Keep the message under ${WELCOME_MESSAGE_MAX} characters.` }
  }
  return { ok: true, message }
}

export function fillWelcome(template: string | null | undefined, fill: WelcomeFill, kind: GreetingKind = "welcome"): string {
  const source = template?.trim() || greetingDefaults[kind]
  return source
    .replace(/@(everyone|here)/gi, "@\u200b$1")
    .replace(/\{(user|name|server|boosts|level)\}/gi, (_match, key: string) => {
      const name = key.toLowerCase()
      if (name === "user") return /^\d{5,22}$/.test(fill.userId) ? `<@${fill.userId}>` : plain(fill.name)
      if (name === "name") return plain(fill.name)
      if (name === "boosts") return String(Math.max(0, Math.floor(fill.boosts ?? 0)))
      if (name === "level") return String(Math.max(0, Math.min(3, Math.floor(fill.level ?? 0))))
      return plain(fill.server)
    })
}

function plain(value: string): string {
  return value.replace(/[\\*_`~|>#\[\]()]/g, "\\$&").replace(/@/g, "@\u200b").replace(/\s+/g, " ").trim().slice(0, 100)
}
