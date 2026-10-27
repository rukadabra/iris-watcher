import { spawn } from "node:child_process"
import type { YoutubeItem } from "@iris/shared"
import type { Readable } from "node:stream"
import { parseMetadata, type YoutubeMeta } from "./metadata"
import { fetchRadio } from "./radio"

const PRINT = "%(id)s\u001f%(title)s"
const PLAYLIST_COUNT = 40

export type YoutubeTools = {
  ytdlp: string
  ffmpeg: string
}

export async function searchYoutube(tools: YoutubeTools, query: string): Promise<YoutubeMeta | null> {
  const found = await listFlat(tools, `ytsearch1:${query}`, 1)
  return found[0] ?? null
}

export async function resolveYoutube(
  tools: YoutubeTools,
  items: YoutubeItem[],
  radio: boolean,
): Promise<YoutubeMeta[]> {
  if (radio && items.length === 1 && items[0]?.type === "video") {
    return radioQueue(tools, items[0].id)
  }

  const tracks: YoutubeMeta[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const found =
      item.type === "playlist"
        ? await listFlat(tools, playlistUrl(item.id), PLAYLIST_COUNT)
        : await listFlat(tools, watchUrl(item.id), 1, true)
    for (const track of found) {
      if (seen.has(track.id)) continue
      seen.add(track.id)
      tracks.push(track)
    }
  }
  return tracks
}

export function openYoutubeStream(tools: YoutubeTools, videoId: string): {
  stream: Readable
  stop: () => void
} {
  const ytdlp = spawn(
    tools.ytdlp,
    ["-f", "bestaudio/best", "-o", "-", "--no-playlist", "--no-warnings", "--quiet", watchUrl(videoId)],
    { stdio: ["ignore", "pipe", "pipe"] },
  )
  const ffmpeg = spawn(
    tools.ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "96000",
      "-f",
      "ogg",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  )

  ytdlp.stdout?.pipe(ffmpeg.stdin)
  ytdlp.stderr?.on("data", () => {})
  ffmpeg.stderr?.on("data", () => {})
  ytdlp.stdout?.on("error", () => {})
  ffmpeg.stdin?.on("error", () => {})

  const stop = () => {
    if (!ytdlp.killed) ytdlp.kill("SIGKILL")
    if (!ffmpeg.killed) ffmpeg.kill("SIGKILL")
  }

  ytdlp.on("error", stop)
  ffmpeg.on("error", stop)
  if (!ffmpeg.stdout) {
    stop()
    throw new Error("ffmpeg tidak menyediakan keluaran audio")
  }

  return { stream: ffmpeg.stdout, stop }
}

function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

function playlistUrl(id: string): string {
  return `https://www.youtube.com/playlist?list=${id}`
}

async function radioQueue(tools: YoutubeTools, videoId: string): Promise<YoutubeMeta[]> {
  const seed = await listFlat(tools, watchUrl(videoId), 1, true)
  let mix: YoutubeMeta[] = []
  try {
    mix = await fetchRadio(videoId)
  } catch (error) {
    console.error("Lanjutan YouTube gagal dibaca", error)
  }

  const tracks: YoutubeMeta[] = []
  const seen = new Set<string>()
  for (const track of [...seed, ...mix]) {
    if (seen.has(track.id)) continue
    seen.add(track.id)
    tracks.push(track)
  }
  return tracks.slice(0, 20)
}

function listFlat(
  tools: YoutubeTools,
  url: string,
  limit: number,
  single = false,
): Promise<YoutubeMeta[]> {
  const args = single
    ? ["--no-playlist", "--no-warnings", "--ignore-errors", "--print", PRINT, url]
    : ["--flat-playlist", "--no-warnings", "--ignore-errors", "-I", `1:${limit}`, "--print", PRINT, url]
  return run(tools.ytdlp, args).then(parseMetadata)
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
    }, 45_000)

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk))
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      const text = Buffer.concat(stdout).toString("utf8")
      if (text.trim()) {
        resolve(text)
        return
      }
      const detail = Buffer.concat(stderr).toString("utf8").trim()
      reject(new Error(detail || `yt-dlp berhenti dengan kode ${code ?? "tidak diketahui"}`))
    })
  })
}
