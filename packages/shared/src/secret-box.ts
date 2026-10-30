import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto"

const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16
const MASTER_BYTES = 32
const SEALED = /^v1\.([A-Za-z0-9_-]{8})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{22})$/

type RingKey = { id: string; key: Buffer }

export type SecretRing = {
  current: RingKey
  previous: RingKey | null
}

export type SecretRingResult = { ok: true; ring: SecretRing | null } | { ok: false; error: string }

export function loadSecretRing(current: string | undefined, previous?: string): SecretRingResult {
  if (!current?.trim()) {
    return previous?.trim() ? { ok: false, error: "AI_KEY_SECRET_PREVIOUS needs AI_KEY_SECRET" } : { ok: true, ring: null }
  }
  const main = ringKey(current)
  if (!main) return { ok: false, error: "AI_KEY_SECRET must be 32 random bytes in base64" }
  if (!previous?.trim()) return { ok: true, ring: { current: main, previous: null } }
  const old = ringKey(previous)
  if (!old) return { ok: false, error: "AI_KEY_SECRET_PREVIOUS must be 32 random bytes in base64" }
  if (old.id === main.id) return { ok: false, error: "AI_KEY_SECRET_PREVIOUS must differ from AI_KEY_SECRET" }
  return { ok: true, ring: { current: main, previous: old } }
}

export function sealSecret(ring: SecretRing, plaintext: string, context: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", ring.current.key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(aad(ring.current.id, context))
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, ring.current.id, iv.toString("base64url"), body.toString("base64url"), tag.toString("base64url")].join(".")
}

export function openSecret(ring: SecretRing, sealed: string, context: string): string | null {
  const match = SEALED.exec(sealed)
  if (!match) return null
  const [, id, ivText, bodyText, tagText] = match as unknown as [string, string, string, string, string]
  const entry = [ring.current, ring.previous].find((candidate) => candidate?.id === id)
  if (!entry) return null
  const iv = Buffer.from(ivText, "base64url")
  const tag = Buffer.from(tagText, "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", entry.key, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(aad(id, context))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(Buffer.from(bodyText, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

export function sealedWithOldKey(ring: SecretRing, sealed: string): boolean {
  const id = SEALED.exec(sealed)?.[1]
  return Boolean(id && id !== ring.current.id)
}

function ringKey(encoded: string): RingKey | null {
  const text = encoded.trim()
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null
  const master = Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  if (master.length !== MASTER_BYTES) return null
  const key = Buffer.from(hkdfSync("sha256", master, "iris-watcher", "ai-provider-key/v1", 32))
  const id = createHmac("sha256", master).update("iris-watcher key id").digest("base64url").slice(0, 8)
  master.fill(0)
  return { id, key }
}

function aad(id: string, context: string): Buffer {
  return Buffer.from(`${VERSION}|${id}|${context}`, "utf8")
}
