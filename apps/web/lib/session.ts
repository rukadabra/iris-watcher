import { oauthStateKey, sessionKey } from "@iris/shared"
import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import type { DiscordToken, DiscordUser, Session } from "./types"
import { connectRedis } from "./redis"

const COOKIE = "iris_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14

function cookieOptions(origin: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}

export async function createOauthState(): Promise<string> {
  const state = randomBytes(16).toString("base64url")
  const redis = await connectRedis()
  await redis.set(oauthStateKey(state), "1", "EX", 600)
  return state
}

export async function consumeOauthState(state: string): Promise<boolean> {
  const redis = await connectRedis()
  const key = oauthStateKey(state)
  const value = await redis.get(key)
  if (!value) return false
  await redis.del(key)
  return true
}

export async function createSession(input: {
  user: DiscordUser
  token: DiscordToken
  origin: string
}): Promise<void> {
  const id = randomBytes(32).toString("base64url")
  const session: Session = {
    id,
    userId: input.user.id,
    username: input.user.global_name ?? input.user.username,
    avatar: input.user.avatar,
    accessToken: input.token.access_token,
    refreshToken: input.token.refresh_token,
    expiresAt: Date.now() + input.token.expires_in * 1000,
  }
  const redis = await connectRedis()
  await redis.set(sessionKey(id), JSON.stringify(session), "EX", SESSION_TTL_SECONDS)
  const jar = await cookies()
  jar.set(COOKIE, id, cookieOptions(input.origin))
}

async function refreshToken(session: Session): Promise<Session | null> {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
    cache: "no-store",
  })
  if (!response.ok) return null
  const token = (await response.json()) as DiscordToken
  return {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const jar = await cookies()
    const id = jar.get(COOKIE)?.value
    if (!id) return null
    const redis = await connectRedis()
    const raw = await redis.get(sessionKey(id))
    if (!raw) return null
    let session = JSON.parse(raw) as Session
    if (session.expiresAt <= Date.now() + 60_000) {
      const refreshed = await refreshToken(session)
      if (!refreshed) {
        await redis.del(sessionKey(id))
        return null
      }
      session = refreshed
      await redis.set(sessionKey(id), JSON.stringify(session), "EX", SESSION_TTL_SECONDS)
    }
    return session
  } catch {
    return null
  }
}

export async function destroySession(origin: string): Promise<void> {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (id) {
    try {
      const redis = await connectRedis()
      await redis.del(sessionKey(id))
    } catch {
      // Clear the cookie anyway so the browser signs out.
    }
  }
  jar.set(COOKIE, "", { ...cookieOptions(origin), maxAge: 0 })
}
