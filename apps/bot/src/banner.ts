import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas"
import { BANNER_FALLBACK_FONTS, BANNER_HEIGHT, BANNER_WIDTH, drawGreetingBanner, type BannerText } from "@iris/shared"
import path from "node:path"
import { fileURLToPath } from "node:url"

const FAMILY = `Poppins, ${BANNER_FALLBACK_FONTS}`
const IMAGE_MS = 5_000
const IMAGE_BYTES = 4 * 1024 * 1024

const fontDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/fonts")
for (const file of ["Poppins-Medium.ttf", "Poppins-SemiBold.ttf", "Poppins-Bold.ttf"]) {
  GlobalFonts.registerFromPath(path.join(fontDir, file), "Poppins")
}

export type BannerInput = BannerText & {
  avatarUrl: string
  iconUrl?: string | null
}

export async function renderWelcomeBanner(input: BannerInput): Promise<Buffer> {
  const [avatar, icon] = await Promise.all([readImage(input.avatarUrl), input.iconUrl ? readImage(input.iconUrl) : null])
  const canvas = createCanvas(BANNER_WIDTH, BANNER_HEIGHT)
  drawGreetingBanner(canvas.getContext("2d"), input, { avatar, icon }, FAMILY)
  return canvas.encode("png")
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
