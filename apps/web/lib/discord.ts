import { isSnowflake } from "@iris/shared"
import type { DiscordGuild, DiscordToken, DiscordUser } from "./types"

export type DiscordTextChannel = {
  id: string
  name: string
}

const API = "https://discord.com/api/v10"

export function discordRedirectUri(origin: string): string {
  return `${origin}/api/auth/callback`
}

export function discordAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(`${API}/oauth2/authorize`)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "identify guilds")
  url.searchParams.set("state", state)
  return url.toString()
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<DiscordToken> {
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Discord code exchange failed")
  return (await response.json()) as DiscordToken
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Discord profile could not be read")
  return (await response.json()) as DiscordUser
}

export async function fetchGuildTextChannels(guildId: string): Promise<DiscordTextChannel[]> {
  const token = process.env.DISCORD_TOKEN
  if (!token || !isSnowflake(guildId)) return []
  const response = await fetch(`${API}/guilds/${guildId}/channels`, {
    headers: { authorization: `Bot ${token}` },
    cache: "no-store",
  })
  if (!response.ok) return []
  const body = (await response.json()) as Array<{ id?: unknown; name?: unknown; type?: unknown; position?: unknown }>
  return body
    .flatMap((channel) => {
      if (typeof channel.id !== "string" || !isSnowflake(channel.id)) return []
      if (channel.type !== 0 && channel.type !== 5) return []
      if (typeof channel.name !== "string" || !channel.name.trim()) return []
      return [{
        id: channel.id,
        name: channel.name.trim().slice(0, 100),
        position: typeof channel.position === "number" ? channel.position : 0,
      }]
    })
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, "en"))
    .map(({ id, name }) => ({ id, name }))
}

export async function fetchGuildBoosts(guildId: string): Promise<{ boosts: number; level: number }> {
  const token = process.env.DISCORD_TOKEN
  if (!token || !isSnowflake(guildId)) return { boosts: 0, level: 0 }
  const response = await fetch(`${API}/guilds/${guildId}`, {
    headers: { authorization: `Bot ${token}` },
    cache: "no-store",
  })
  if (!response.ok) return { boosts: 0, level: 0 }
  const body = (await response.json()) as { premium_subscription_count?: unknown; premium_tier?: unknown }
  return {
    boosts: typeof body.premium_subscription_count === "number" ? body.premium_subscription_count : 0,
    level: typeof body.premium_tier === "number" ? body.premium_tier : 0,
  }
}

export async function fetchDiscordGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const guilds: DiscordGuild[] = []
  let after: string | undefined

  for (;;) {
    const url = new URL(`${API}/users/@me/guilds`)
    url.searchParams.set("limit", "200")
    if (after) url.searchParams.set("after", after)
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
    if (!response.ok) throw new Error("Discord server list could not be read")
    const page = (await response.json()) as DiscordGuild[]
    guilds.push(...page)
    const last = page.at(-1)
    if (page.length < 200 || !last) break
    after = last.id
  }

  return guilds
}
