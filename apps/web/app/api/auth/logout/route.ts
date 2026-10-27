import { readWebEnv } from "@/lib/env"
import { destroySession } from "@/lib/session"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const config = readWebEnv()
  const origin = config.ok ? config.env.WEB_ORIGIN : new URL(request.url).origin
  await destroySession(origin)
  return NextResponse.redirect(new URL("/", origin))
}
