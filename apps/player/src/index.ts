import { timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { YoutubeItem } from "@iris/shared"
import { z } from "zod"
import { loadPlayerEnv } from "./env"
import { lookupChannel, readLives } from "./live"
import { openYoutubeStream, resolveYoutube, searchYoutube } from "./youtube"

const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/)
const playlistId = z.string().regex(/^[A-Za-z0-9_-]{12,64}$/)
const searchBody = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((query) => !/[\u0000-\u001f]/.test(query), "The title contains a character that cannot be used."),
})

const channelBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("id"), id: z.string().regex(/^UC[\w-]{22}$/) }),
  z.object({ type: z.literal("handle"), handle: z.string().regex(/^[\p{L}\p{N}._-]{3,30}$/u) }),
  z.object({
    type: z.literal("custom"),
    kind: z.enum(["c", "user"]),
    name: z.string().regex(/^[\p{L}\p{N}._-]{1,80}$/u),
  }),
])

const liveBody = z.object({
  ids: z.array(z.string().regex(/^UC[\w-]{22}$/)).min(1).max(50),
})

const resolveBody = z.object({
  items: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("video"), id: videoId }),
        z.object({ type: z.literal("playlist"), id: playlistId }),
      ]),
    )
    .min(1)
    .max(10),
  radio: z.boolean().default(false),
})

const env = loadPlayerEnv()
const tools = { ytdlp: env.YTDLP_PATH, ffmpeg: env.FFMPEG_PATH }

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    console.error(error)
    sendJson(response, 500, { error: "The music service failed." })
  })
})

server.listen(env.PLAYER_PORT, env.PLAYER_HOST, () => {
  console.info(`YouTube player listening at http://${env.PLAYER_HOST}:${env.PLAYER_PORT}`)
})

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://player")

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true })
    return
  }

  if (!authorized(request.headers.authorization, env.PLAYER_TOKEN)) {
    sendJson(response, 401, { error: "The player token is not valid." })
    return
  }

  if (request.method === "POST" && url.pathname === "/search") {
    const json: unknown = JSON.parse(await readBody(request))
    const parsed = searchBody.safeParse(json)
    if (!parsed.success) {
      sendJson(response, 400, { error: "The song title is not valid." })
      return
    }
    try {
      const track = await searchYoutube(tools, parsed.data.query)
      if (!track) {
        sendJson(response, 404, { error: "YouTube could not find that song." })
        return
      }
      sendJson(response, 200, { track })
    } catch (error) {
      sendJson(response, 503, { error: youtubeFailure(error) })
    }
    return
  }

  if (request.method === "POST" && url.pathname === "/channel") {
    const json: unknown = JSON.parse(await readBody(request))
    const parsed = channelBody.safeParse(json)
    if (!parsed.success) {
      sendJson(response, 400, { error: "The channel is not valid." })
      return
    }
    try {
      const channel = await lookupChannel(parsed.data)
      if (!channel) {
        sendJson(response, 404, { error: "YouTube could not find that channel." })
        return
      }
      sendJson(response, 200, { channel })
    } catch (error) {
      sendJson(response, 503, { error: youtubeFailure(error) })
    }
    return
  }

  if (request.method === "POST" && url.pathname === "/live") {
    const json: unknown = JSON.parse(await readBody(request))
    const parsed = liveBody.safeParse(json)
    if (!parsed.success) {
      sendJson(response, 400, { error: "The channel is not valid." })
      return
    }
    try {
      const channels = await readLives(parsed.data.ids)
      sendJson(response, 200, { channels })
    } catch (error) {
      sendJson(response, 503, { error: youtubeFailure(error) })
    }
    return
  }

  if (request.method === "POST" && url.pathname === "/resolve") {
    const json: unknown = JSON.parse(await readBody(request))
    const parsed = resolveBody.safeParse(json)
    if (!parsed.success) {
      sendJson(response, 400, { error: "The song request is not valid." })
      return
    }
    try {
      const tracks = await resolveYoutube(tools, parsed.data.items as YoutubeItem[], parsed.data.radio)
      sendJson(response, 200, { tracks })
    } catch (error) {
      sendJson(response, 503, { error: youtubeFailure(error) })
    }
    return
  }

  const streamMatch = /^\/stream\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)
  if (request.method === "GET" && streamMatch?.[1]) {
    const opened = openYoutubeStream(tools, streamMatch[1])
    const stop = () => opened.stop()
    let started = false
    const fail = () => {
      stop()
      if (!started) sendJson(response, 503, { error: "YouTube audio could not be opened." })
      else response.destroy()
    }
    const timer = setTimeout(() => {
      if (!started) fail()
    }, 20_000)
    opened.stream.once("data", (chunk: Buffer) => {
      clearTimeout(timer)
      started = true
      response.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" })
      response.write(chunk)
      opened.stream.pipe(response)
    })
    opened.stream.once("error", () => {
      clearTimeout(timer)
      fail()
    })
    opened.stream.once("end", () => {
      clearTimeout(timer)
      if (!started) fail()
    })
    response.on("close", () => {
      clearTimeout(timer)
      stop()
    })
    request.on("close", () => {
      clearTimeout(timer)
      stop()
    })
    return
  }

  sendJson(response, 404, { error: "Not found." })
}

function youtubeFailure(error: unknown): string {
  const missing = error instanceof Error && "code" in error && error.code === "ENOENT"
  return missing ? "yt-dlp is not installed." : "YouTube could not be read."
}

function authorized(header: string | undefined, token: string): boolean {
  if (!header?.startsWith("Bearer ")) return false
  const given = Buffer.from(header.slice("Bearer ".length))
  const expected = Buffer.from(token)
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 32_768) {
        reject(new Error("Body terlalu besar"))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    request.on("error", reject)
  })
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}
