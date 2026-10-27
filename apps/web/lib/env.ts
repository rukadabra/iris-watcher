import { customPrefixSchema, DEFAULT_PREFIX, definedEnv } from "@iris/shared"
import { z } from "zod"

const webEnvSchema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1),
  DEFAULT_PREFIX: z.string().min(1).default(DEFAULT_PREFIX),
})

export type WebEnv = z.infer<typeof webEnvSchema> & { WEB_ORIGIN: string; DEFAULT_PREFIX: string }

export function readWebEnv(): { ok: true; env: WebEnv } | { ok: false; error: string } {
  const parsed = webEnvSchema.safeParse(definedEnv())
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "env").join(", ")
    return { ok: false, error: `Environment variables are incomplete: ${fields}` }
  }

  const prefix = customPrefixSchema.safeParse(parsed.data.DEFAULT_PREFIX)
  if (!prefix.success) return { ok: false, error: "DEFAULT_PREFIX is not valid" }

  return {
    ok: true,
    env: {
      ...parsed.data,
      DEFAULT_PREFIX: prefix.data,
      WEB_ORIGIN: parsed.data.WEB_ORIGIN.replace(/\/$/, ""),
    },
  }
}
