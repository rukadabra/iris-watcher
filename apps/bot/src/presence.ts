import { ActivityType } from "discord.js"
import { client } from "./client"

const NAME_LIMIT = 128

type NowPlaying = {
  title: string
  paused: boolean
}

let shown = "online:YouTube"

function activityName(title: string): string {
  const flat = title.replace(/\s+/g, " ").trim()
  return (flat || "YouTube").slice(0, NAME_LIMIT)
}

export function showPresence(now: NowPlaying | null): void {
  if (!client.user) return
  const status = now?.paused ? "idle" : "online"
  const name = activityName(now?.title ?? "YouTube")
  const key = `${status}:${name}`
  if (key === shown) return
  shown = key
  client.user.setPresence({
    status,
    activities: [{ name, type: ActivityType.Listening }],
  })
}
