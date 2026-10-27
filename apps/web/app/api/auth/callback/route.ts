import { discordRedirectUri, exchangeCode, fetchDiscordUser } from "@/lib/discord"
import { readWebEnv } from "@/lib/env"
import { consumeOauthState, createSession } from "@/lib/session"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const config = readWebEnv()
  const origin = config.ok ? config.env.WEB_ORIGIN : new URL(request.url).origin
  const dashboard = new URL("/dashboard", origin)

  if (!config.ok) {
    dashboard.searchParams.set("error", "oauth")
    return NextResponse.redirect(dashboard)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state || !(await consumeOauthState(state))) {
    dashboard.searchParams.set("error", "state")
    return NextResponse.redirect(dashboard)
  }

  try {
    const token = await exchangeCode(
      code,
      config.env.DISCORD_CLIENT_ID,
      config.env.DISCORD_CLIENT_SECRET,
      discordRedirectUri(config.env.WEB_ORIGIN),
    )
    const user = await fetchDiscordUser(token.access_token)
    await createSession({ user, token, origin: config.env.WEB_ORIGIN })
    return NextResponse.redirect(dashboard)
  } catch (error) {
    console.error(error)
    dashboard.searchParams.set("error", "oauth")
    return NextResponse.redirect(dashboard)
  }
}
