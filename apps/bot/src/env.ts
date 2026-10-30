import { customPrefixSchema, DEFAULT_PREFIX, definedEnv, loadSecretRing, type SecretRing } from "@iris/shared"
import { z } from "zod"

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1),
  DEFAULT_PREFIX: z.string().min(1).default(DEFAULT_PREFIX),
  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PLAYER_URL: z.string().min(1).optional(),
  PLAYER_TOKEN: z.string().min(16).optional(),
  AI_KEY_SECRET: z.string().optional(),
  AI_KEY_SECRET_PREVIOUS: z.string().optional(),
})

export type BotEnv = Omit<z.infer<typeof envSchema>, "AI_KEY_SECRET" | "AI_KEY_SECRET_PREVIOUS"> & {
  WEB_ORIGIN: string
  aiKeys: SecretRing | null
}

export function loadEnv(): BotEnv {
  const parsed = envSchema.safeParse(definedEnv())
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "env").join(", ")
    throw new Error(`Bot environment variables are incomplete: ${fields}`)
  }

  const prefix = customPrefixSchema.safeParse(parsed.data.DEFAULT_PREFIX)
  if (!prefix.success) {
    throw new Error("DEFAULT_PREFIX is not valid")
  }

  const { AI_KEY_SECRET, AI_KEY_SECRET_PREVIOUS, ...rest } = parsed.data
  const aiKeys = loadSecretRing(AI_KEY_SECRET, AI_KEY_SECRET_PREVIOUS)
  if (!aiKeys.ok) throw new Error(aiKeys.error)

  return {
    ...rest,
    DEFAULT_PREFIX: prefix.data,
    WEB_ORIGIN: parsed.data.WEB_ORIGIN.replace(/\/$/, ""),
    aiKeys: aiKeys.ring,
  }
}
