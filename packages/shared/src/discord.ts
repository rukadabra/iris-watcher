const VIEW_CHANNEL = 1 << 10
const SEND_MESSAGES = 1 << 11
const EMBED_LINKS = 1 << 14
const READ_MESSAGE_HISTORY = 1 << 16
const CONNECT = 1 << 20
const SPEAK = 1 << 21

export const BOT_INVITE_PERMISSIONS =
  VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | READ_MESSAGE_HISTORY | CONNECT | SPEAK

const MANAGE_GUILD = 1n << 5n
const ADMINISTRATOR = 1n << 3n

export function inviteUrl(clientId: string): string {
  const url = new URL("https://discord.com/oauth2/authorize")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("permissions", String(BOT_INVITE_PERMISSIONS))
  url.searchParams.set("scope", "bot")
  return url.toString()
}

export function canManageGuild(permissions: string, owner: boolean): boolean {
  if (owner) return true
  try {
    const bits = BigInt(permissions)
    return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD
  } catch {
    return false
  }
}

export function isSnowflake(value: string): boolean {
  return /^\d{5,22}$/.test(value)
}
