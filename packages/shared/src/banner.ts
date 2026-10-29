import type { GreetingKind } from "./welcome"

export const BANNER_WIDTH = 1100
export const BANNER_HEIGHT = 420
export const BANNER_FALLBACK_FONTS = `"Noto Sans", "Noto Color Emoji", sans-serif`

const AVATAR = { x: 210, y: 210, radius: 122 }

type Gradient = { addColorStop(offset: number, color: string): void }

export type BannerContext = {
  fillStyle: unknown
  strokeStyle: unknown
  shadowColor: string
  shadowBlur: number
  lineWidth: number
  globalAlpha: number
  font: string
  letterSpacing: string
  textAlign: string
  textBaseline: string
  save(): void
  restore(): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  arc(x: number, y: number, radius: number, start: number, end: number): void
  roundRect(x: number, y: number, width: number, height: number, radii: number): void
  fill(): void
  stroke(): void
  clip(): void
  fillRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient
  drawImage(image: never, x: number, y: number, width: number, height: number): void
}

export type BannerText = {
  kind?: GreetingKind
  name: string
  server: string
  boosts?: number
  level?: number
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

const themes: Record<GreetingKind, Theme> = {
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

export function drawGreetingBanner<Image>(
  ctx: BannerContext,
  input: BannerText,
  images: { avatar: Image | null; icon: Image | null },
  family: string,
): void {
  const kind = input.kind ?? "welcome"
  const theme = themes[kind]

  paintBackground(ctx, theme)
  if (kind === "boost") paintSparkles(ctx, theme)
  paintAvatar(ctx, images.avatar, input.name, theme, family)
  if (kind === "boost") paintGem(ctx, theme)
  if (images.icon) paintIcon(ctx, images.icon, theme)

  const left = 400
  const room = BANNER_WIDTH - left - 70
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  ctx.fillStyle = kind === "boost" ? gradient(ctx, left, 360, theme) : theme.accent
  ctx.font = `600 ${kind === "boost" ? 24 : 28}px ${family}`
  ctx.letterSpacing = kind === "boost" ? "6px" : "10px"
  ctx.fillText(theme.label, left, 152)
  ctx.letterSpacing = "0px"

  const name = cleanBannerText(input.name) || (kind === "boost" ? "A booster" : "New member")
  const size = fitSize(ctx, name, room, 74, 44, 700, family)
  ctx.font = `700 ${size}px ${family}`
  ctx.fillStyle = theme.name
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)"
  ctx.shadowBlur = 18
  ctx.fillText(ellipsis(ctx, name, room), left, 240)
  ctx.shadowBlur = 0

  const server = cleanBannerText(input.server) || "the server"
  ctx.font = `500 30px ${family}`
  ctx.fillStyle = theme.sub
  ctx.fillText(ellipsis(ctx, kind === "boost" ? server : `to ${server}`, room), left, 292)

  if (kind === "boost" && (input.boosts || input.level)) {
    paintChip(ctx, left, 318, boostLine(input.boosts, input.level), theme, family)
  } else {
    const bar = ctx.createLinearGradient(left, 0, left + 140, 0)
    bar.addColorStop(0, theme.accent)
    bar.addColorStop(1, `rgba(${theme.glow}, 0)`)
    ctx.fillStyle = bar
    ctx.beginPath()
    ctx.roundRect(left, 322, 140, 5, 3)
    ctx.fill()
  }
}

export function cleanBannerText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 64)
}

function boostLine(boosts?: number, level?: number): string {
  const parts = []
  if (boosts) parts.push(`${boosts} ${boosts === 1 ? "BOOST" : "BOOSTS"}`)
  if (level) parts.push(`LEVEL ${level}`)
  return parts.join("  ·  ")
}

function gradient(ctx: BannerContext, x: number, width: number, theme: Theme): Gradient {
  const fill = ctx.createLinearGradient(x, 0, x + width, 0)
  fill.addColorStop(0, theme.accent)
  fill.addColorStop(1, theme.accentLight)
  return fill
}

function paintBackground(ctx: BannerContext, theme: Theme): void {
  const base = ctx.createLinearGradient(0, 0, BANNER_WIDTH, BANNER_HEIGHT)
  base.addColorStop(0, theme.base[0])
  base.addColorStop(0.55, theme.base[1])
  base.addColorStop(1, theme.base[2])
  ctx.fillStyle = base
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT)

  const glow = ctx.createRadialGradient(AVATAR.x, AVATAR.y, 40, AVATAR.x, AVATAR.y, 420)
  glow.addColorStop(0, `rgba(${theme.glow}, 0.32)`)
  glow.addColorStop(1, `rgba(${theme.glow}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT)

  const corner = ctx.createRadialGradient(BANNER_WIDTH, 0, 0, BANNER_WIDTH, 0, 520)
  corner.addColorStop(0, `rgba(${theme.glow}, 0.12)`)
  corner.addColorStop(1, `rgba(${theme.glow}, 0)`)
  ctx.fillStyle = corner
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT)

  ctx.strokeStyle = `rgba(${theme.glow}, 0.08)`
  ctx.lineWidth = 2
  for (const radius of [260, 340, 420]) {
    ctx.beginPath()
    ctx.arc(BANNER_WIDTH + 40, BANNER_HEIGHT + 60, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = theme.frame
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(18, 18, BANNER_WIDTH - 36, BANNER_HEIGHT - 36, 28)
  ctx.stroke()
}

function paintSparkles(ctx: BannerContext, theme: Theme): void {
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

function paintAvatar<Image>(ctx: BannerContext, avatar: Image | null, name: string, theme: Theme, family: string): void {
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
    ctx.drawImage(avatar as never, x - radius, y - radius, radius * 2, radius * 2)
  } else {
    ctx.fillStyle = theme.base[0]
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    ctx.fillStyle = theme.accent
    ctx.font = `700 110px ${family}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((cleanBannerText(name)[0] ?? "?").toUpperCase(), x, y + 6)
  }
  ctx.restore()
}

function paintGem(ctx: BannerContext, theme: Theme): void {
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

function paintChip(ctx: BannerContext, x: number, y: number, text: string, theme: Theme, family: string): void {
  ctx.font = `600 18px ${family}`
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

function paintIcon<Image>(ctx: BannerContext, icon: Image, theme: Theme): void {
  const size = 64
  const x = BANNER_WIDTH - 52 - size
  const y = 48
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(icon as never, x, y, size, size)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${theme.glow}, 0.6)`
  ctx.lineWidth = 3
  ctx.stroke()
}

function fitSize(ctx: BannerContext, text: string, width: number, max: number, min: number, weight: number, family: string): number {
  for (let size = max; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= width) return size
  }
  return min
}

function ellipsis(ctx: BannerContext, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  const chars = [...text]
  while (chars.length > 1 && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop()
  return `${chars.join("").trimEnd()}…`
}
