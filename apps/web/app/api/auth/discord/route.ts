import { readWebEnv } from "@/lib/env"
import { createOauthState } from "@/lib/session"
import { discordAuthorizeUrl, discordRedirectUri } from "@/lib/discord"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const config = readWebEnv()
  if (!config.ok) {
    return NextResponse.redirect(new URL("/dashboard?error=oauth", request.url))
  }

  const state = await createOauthState()
  const url = discordAuthorizeUrl(
    config.env.DISCORD_CLIENT_ID,
    discordRedirectUri(config.env.WEB_ORIGIN),
    state,
  )
  return NextResponse.redirect(url)
}
