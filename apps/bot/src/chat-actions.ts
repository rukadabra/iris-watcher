import type { AiAction, AiTool } from "@iris/shared"

export type ChatAction = { command: string; args: string[] }

const TEXT_MAX = 200
const none = { type: "object" as const, properties: {} }

export const CHAT_TOOLS: AiTool[] = [
  {
    name: "play",
    description: "Play a song in the voice channel the person is in, or add it to the queue.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Song title and artist, or a YouTube link, exactly as they asked." },
        replace: { type: "boolean", description: "True only when they ask to replace the current queue." },
      },
      required: ["query"],
    },
  },
  { name: "pause", description: "Pause the song that is playing.", parameters: none },
  { name: "resume", description: "Resume the paused song.", parameters: none },
  { name: "skip", description: "Skip to the next song.", parameters: none },
  { name: "stop", description: "Stop the music and clear the queue.", parameters: none },
  { name: "queue", description: "Show the music queue.", parameters: none },
  {
    name: "loop",
    description: "Repeat the current song, repeat the queue, or turn repeat off.",
    parameters: {
      type: "object",
      properties: { mode: { type: "string", description: "One of: one, all, off." } },
      required: ["mode"],
    },
  },
  { name: "leave", description: "Leave the voice channel.", parameters: none },
  {
    name: "weather",
    description: "Show the current weather for a city.",
    parameters: {
      type: "object",
      properties: { city: { type: "string", description: "City name." } },
      required: ["city"],
    },
  },
  {
    name: "lyrics",
    description: "Show song lyrics. Leave the title empty for the song that is playing.",
    parameters: {
      type: "object",
      properties: { title: { type: "string", description: "Song title and artist, optional." } },
    },
  },
]

export function chatAction(action: AiAction): ChatAction | null {
  const text = (key: string) => {
    const value = action.args[key]
    return typeof value === "string" ? value.replace(/[<@#&>]/g, " ").replace(/\s+/g, " ").trim().slice(0, TEXT_MAX) : ""
  }
  switch (action.name) {
    case "play": {
      const query = text("query")
      if (!query) return null
      return { command: "play", args: [...(action.args.replace === true ? ["new"] : []), ...query.split(" ")] }
    }
    case "pause":
    case "resume":
    case "skip":
    case "stop":
    case "queue":
    case "leave":
      return { command: action.name, args: [] }
    case "loop": {
      const mode = text("mode").toLowerCase()
      return mode === "one" || mode === "all" || mode === "off" ? { command: "loop", args: [mode] } : null
    }
    case "weather": {
      const city = text("city")
      return city ? { command: "weather", args: city.split(" ") } : null
    }
    case "lyrics": {
      const title = text("title")
      return { command: "lyrics", args: title ? title.split(" ") : [] }
    }
    default:
      return null
  }
}
