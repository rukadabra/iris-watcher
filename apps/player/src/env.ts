import { definedEnv, loadEnvFile } from "@iris/shared"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"))

const envSchema = z.object({
  PLAYER_TOKEN: z.string().min(16),
  PLAYER_HOST: z.string().min(1).default("127.0.0.1"),
  PLAYER_PORT: z.coerce.number().int().min(1).max(65535).default(8090),
  YTDLP_PATH: z.string().min(1).default("yt-dlp"),
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
})

export type PlayerEnv = z.infer<typeof envSchema>

export function loadPlayerEnv(): PlayerEnv {
  const parsed = envSchema.safeParse(definedEnv())
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "env").join(", ")
    throw new Error(`Player environment variables are incomplete: ${fields}`)
  }
  return parsed.data
}
