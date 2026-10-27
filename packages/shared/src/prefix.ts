import { z } from "zod"

export const DEFAULT_PREFIX = "!iris"

export const customPrefixSchema = z
  .string()
  .min(1, "Prefix is required")
  .max(12, "Prefix can be at most 12 characters")
  .refine((value) => !/\s/u.test(value), "Prefix cannot contain spaces")
  .refine((value) => !/[@<>]/u.test(value), "Prefix cannot contain @ or a mention")

export type ParsedCommand = {
  name: string
  args: string[]
}

export function parseCustomPrefix(
  input: string,
): { ok: true; prefix: string } | { ok: false; error: string } {
  const parsed = customPrefixSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? "Prefix is not valid" }
  }
  return { ok: true, prefix: parsed.data }
}

export function parseCommand(content: string, prefix: string): ParsedCommand | null {
  if (!prefix || !content.startsWith(prefix)) return null

  let rest = content.slice(prefix.length)
  const prefixEndsWithWord = /[\p{L}\p{N}]$/u.test(prefix)
  if (prefixEndsWithWord) {
    if (!rest.startsWith(" ")) return null
    rest = rest.trim()
  } else {
    rest = rest.trimStart()
  }

  if (!rest) return null
  const [name, ...args] = rest.split(/\s+/)
  if (!name) return null
  return { name: name.toLowerCase(), args }
}
