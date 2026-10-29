import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas"
import path from "node:path"
import { fileURLToPath } from "node:url"

const WIDTH = 1100
const HEIGHT = 420
const FAMILY = `Poppins, "Noto Sans", "Noto Color Emoji", sans-serif`
const IMAGE_MS = 5_000
const IMAGE_BYTES = 4 * 1024 * 1024
const AVATAR = { x: 210, y: 210, radius: 122 }

const fontDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts")
for (const file of ["Poppins-Medium.ttf", "Poppins-SemiBold.ttf", "Poppins-Bold.ttf"]) {
  GlobalFonts.registerFromPath(path.join(fontDir, file), "Poppins")
}

type Theme = {
  label: string
  accent: string
  accentLight: string
  glow: string
  base: [string, string, string]
  name: string
  sub: string
  frame: string
  hole: string
}

const themes: Record<"welcome" | "boost", Theme> = {
  welcome: {
    label: "WELCOME",
    accent: "#d7a15f",
    accentLight: "#f1cf98",
    glow: "215, 161, 95",
    base: ["#1d150d", "#16110b", "#0f0b07"],
    name: "#fff8ee",
    sub: "#d9cdbb",
    frame: "rgba(215, 161, 95, 0.35)",
    hole: "#16110b",
  },
  boost: {
    label: "THANK YOU FOR BOOSTING",
    accent: "#ff73fa",
    accentLight: "#b9a6ff",
    glow: "255, 115, 250",
    base: ["#22102b", "#170b20", "#0e0714"],
    name: "#fff4ff",
    sub: "#dcc8ea",
    frame: "rgba(255, 115, 250, 0.35)",
    hole: "#170b20",
  },
}

export type BannerInput = {
  kind?: "welcome" | "boost"
  name: string
  server: string
  avatarUrl: string
  iconUrl?: string | null
  boosts?: number
  level?: number
}

export async function renderWelcomeBanner(input: BannerInput): Promise<Buffer> {
  const kind = input.kind ?? "welcome"
  const theme = themes[kind]
  const [avatar, icon] = await Promise.all([readImage(input.avatarUrl), input.iconUrl ? readImage(input.iconUrl) : null])
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext("2d")

  paintBackground(ctx, theme)
  if (kind === "boost") paintSparkles(ctx, theme)
  paintAvatar(ctx, avatar, input.name, theme)
  if (kind === "boost") paintGem(ctx, theme)
  if (icon) paintIcon(ctx, icon, theme)

  const left = 400
  const room = WIDTH - left - 70
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  ctx.fillStyle = kind === "boost" ? gradient(ctx, left, 360, theme) : theme.accent
  ctx.font = `600 ${kind === "boost" ? 24 : 28}px ${FAMILY}`
  ctx.letterSpacing = kind === "boost" ? "6px" : "10px"
  ctx.fillText(theme.label, left, 152)
  ctx.letterSpacing = "0px"

  const name = clean(input.name) || (kind === "boost" ? "A booster" : "New member")
  const size = fitSize(ctx, name, room, 74, 44, 700)
  ctx.font = `700 ${size}px ${FAMILY}`
  ctx.fillStyle = theme.name
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)"
  ctx.shadowBlur = 18
  ctx.fillText(ellipsis(ctx, name, room), left, 240)
  ctx.shadowBlur = 0

  const server = clean(input.server) || "the server"
  ctx.font = `500 30px ${FAMILY}`
  ctx.fillStyle = theme.sub
  ctx.fillText(ellipsis(ctx, kind === "boost" ? server : `to ${server}`, room), left, 292)

  if (kind === "boost" && (input.boosts || input.level)) {
    paintChip(ctx, left, 318, boostLine(input.boosts, input.level), theme)
  } else {
    const bar = ctx.createLinearGradient(left, 0, left + 140, 0)
    bar.addColorStop(0, theme.accent)
    bar.addColorStop(1, `rgba(${theme.glow}, 0)`)
    ctx.fillStyle = bar
    ctx.beginPath()
    ctx.roundRect(left, 322, 140, 5, 3)
    ctx.fill()
  }

  return canvas.encode("png")
}

function boostLine(boosts?: number, level?: number): string {
  const parts = []
  if (boosts) parts.push(`${boosts} ${boosts === 1 ? "BOOST" : "BOOSTS"}`)
  if (level) parts.push(`LEVEL ${level}`)
  return parts.join("  ·  ")
}

function gradient(ctx: SKRSContext2D, x: number, width: number, theme: Theme) {
  const fill = ctx.createLinearGradient(x, 0, x + width, 0)
  fill.addColorStop(0, theme.accent)
  fill.addColorStop(1, theme.accentLight)
  return fill
}

function paintBackground(ctx: SKRSContext2D, theme: Theme): void {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  base.addColorStop(0, theme.base[0])
  base.addColorStop(0.55, theme.base[1])
  base.addColorStop(1, theme.base[2])
  ctx.fillStyle = base
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const glow = ctx.createRadialGradient(AVATAR.x, AVATAR.y, 40, AVATAR.x, AVATAR.y, 420)
  glow.addColorStop(0, `rgba(${theme.glow}, 0.32)`)
  glow.addColorStop(1, `rgba(${theme.glow}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const corner = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, 520)
  corner.addColorStop(0, `rgba(${theme.glow}, 0.12)`)
  corner.addColorStop(1, `rgba(${theme.glow}, 0)`)
  ctx.fillStyle = corner
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = `rgba(${theme.glow}, 0.08)`
  ctx.lineWidth = 2
  for (const radius of [260, 340, 420]) {
    ctx.beginPath()
    ctx.arc(WIDTH + 40, HEIGHT + 60, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = theme.frame
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(18, 18, WIDTH - 36, HEIGHT - 36, 28)
  ctx.stroke()
}

function paintSparkles(ctx: SKRSContext2D, theme: Theme): void {
  const stars: Array<[number, number, number, number]> = [
    [860, 120, 16, 0.85],
    [960, 300, 11, 0.6],
    [1010, 190, 7, 0.5],
    [780, 350, 8, 0.45],
    [92, 76, 9, 0.55],
    [340, 360, 10, 0.5],
  ]
  for (const [x, y, size, alpha] of stars) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = gradient(ctx, x - size, size * 2, theme)
    ctx.shadowColor = theme.accent
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.quadraticCurveTo(x, y, x + size, y)
    ctx.quadraticCurveTo(x, y, x, y + size)
    ctx.quadraticCurveTo(x, y, x - size, y)
    ctx.quadraticCurveTo(x, y, x, y - size)
    ctx.fill()
    ctx.restore()
  }
}

function paintAvatar(ctx: SKRSContext2D, avatar: Image | null, name: string, theme: Theme): void {
  const { x, y, radius } = AVATAR
  const ring = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius)
  ring.addColorStop(0, theme.accentLight)
  ring.addColorStop(1, theme.accent)
  ctx.beginPath()
  ctx.arc(x, y, radius + 10, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.shadowColor = `rgba(${theme.glow}, 0.55)`
  ctx.shadowBlur = 30
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
  ctx.fillStyle = theme.hole
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.clip()
  if (avatar) {
    ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2)
  } else {
    ctx.fillStyle = theme.base[0]
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    ctx.fillStyle = theme.accent
    ctx.font = `700 110px ${FAMILY}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((clean(name)[0] ?? "?").toUpperCase(), x, y + 6)
  }
  ctx.restore()
}

function paintGem(ctx: SKRSContext2D, theme: Theme): void {
  const cx = AVATAR.x + 88
  const cy = AVATAR.y + 88
  const r = 36

  ctx.beginPath()
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2)
  ctx.fillStyle = theme.hole
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  const disc = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  disc.addColorStop(0, theme.accentLight)
  disc.addColorStop(1, theme.accent)
  ctx.fillStyle = disc
  ctx.shadowColor = `rgba(${theme.glow}, 0.7)`
  ctx.shadowBlur = 18
  ctx.fill()
  ctx.shadowBlur = 0

  const top = cy - 15
  const waist = cy - 4
  const bottom = cy + 18
  const half = 17
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.moveTo(cx - half + 6, top)
  ctx.lineTo(cx + half - 6, top)
  ctx.lineTo(cx + half, waist)
  ctx.lineTo(cx, bottom)
  ctx.lineTo(cx - half, waist)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - half, waist)
  ctx.lineTo(cx + half, waist)
  ctx.moveTo(cx - 5, top)
  ctx.lineTo(cx - 8, waist)
  ctx.lineTo(cx, bottom)
  ctx.lineTo(cx + 8, waist)
  ctx.lineTo(cx + 5, top)
  ctx.stroke()
}

function paintChip(ctx: SKRSContext2D, x: number, y: number, text: string, theme: Theme): void {
  ctx.font = `600 18px ${FAMILY}`
  ctx.letterSpacing = "3px"
  const width = ctx.measureText(text).width + 36
  ctx.beginPath()
  ctx.roundRect(x, y, width, 38, 19)
  ctx.fillStyle = `rgba(${theme.glow}, 0.14)`
  ctx.fill()
  ctx.strokeStyle = `rgba(${theme.glow}, 0.55)`
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = theme.name
  ctx.fillText(text, x + 18, y + 26)
  ctx.letterSpacing = "0px"
}

function paintIcon(ctx: SKRSContext2D, icon: Image, theme: Theme): void {
  const size = 64
  const x = WIDTH - 52 - size
  const y = 48
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(icon, x, y, size, size)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${theme.glow}, 0.6)`
  ctx.lineWidth = 3
  ctx.stroke()
}

function fitSize(ctx: SKRSContext2D, text: string, width: number, max: number, min: number, weight: number): number {
  for (let size = max; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${FAMILY}`
    if (ctx.measureText(text).width <= width) return size
  }
  return min
}

function ellipsis(ctx: SKRSContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  const chars = [...text]
  while (chars.length > 1 && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop()
  return `${chars.join("").trimEnd()}…`
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 64)
}

async function readImage(url: string): Promise<Image | null> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" || !/(^|\.)(discordapp\.com|discord\.com|discordapp\.net)$/i.test(parsed.hostname)) {
      return null
    }
    const response = await fetch(parsed, { signal: AbortSignal.timeout(IMAGE_MS) })
    if (!response.ok) return null
    const body = Buffer.from(await response.arrayBuffer())
    if (body.byteLength === 0 || body.byteLength > IMAGE_BYTES) return null
    return await loadImage(body)
  } catch {
    return null
  }
}
