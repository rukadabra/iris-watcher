"use client"

import { BANNER_FALLBACK_FONTS, BANNER_HEIGHT, BANNER_WIDTH, drawGreetingBanner } from "@iris/shared/banner"
import { fillWelcome, type GreetingKind } from "@iris/shared/welcome"
import { Poppins } from "next/font/google"
import { useEffect, useRef, type ReactNode } from "react"

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"] })

export type PreviewMember = {
  userId: string
  name: string
  avatarUrl: string
  server: string
  iconUrl: string | null
  boosts: number
  level: number
}

export function GreetingPreview({ kind, message, member }: { kind: GreetingKind; message: string; member: PreviewMember }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = fillWelcome(
    message,
    { userId: member.userId, name: member.name, server: member.server, boosts: member.boosts, level: member.level },
    kind,
  )

  useEffect(() => {
    let live = true
    const family = `${poppins.style.fontFamily}, ${BANNER_FALLBACK_FONTS}`
    Promise.all([
      loadImage(member.avatarUrl),
      member.iconUrl ? loadImage(member.iconUrl) : null,
      ...["500", "600", "700"].map((weight) => document.fonts.load(`${weight} 40px ${poppins.style.fontFamily}`)),
    ]).then(([avatar, icon]) => {
      const ctx = canvas.current?.getContext("2d")
      if (!live || !ctx) return
      ctx.clearRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT)
      drawGreetingBanner(
        ctx,
        { kind, name: member.name, server: member.server, boosts: member.boosts, level: member.level },
        { avatar: avatar as HTMLImageElement | null, icon: icon as HTMLImageElement | null },
        family,
      )
    })
    return () => {
      live = false
    }
  }, [kind, member])

  return (
    <figure className="greeting-preview" aria-label="Preview">
      <figcaption className="meta">Preview</figcaption>
      <div className="discord-message">
        <p className="discord-text">{discordText(text, member)}</p>
        <canvas ref={canvas} width={BANNER_WIDTH} height={BANNER_HEIGHT} role="img" aria-label={`${kind} banner preview`} />
      </div>
    </figure>
  )
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function discordText(text: string, member: PreviewMember): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /<@(\d+)>|\*\*([\s\S]+?)\*\*|\\([\\*_`~|>#[\]()])|\n/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index
    if (at > last) nodes.push(text.slice(last, at))
    if (match[1]) {
      nodes.push(
        <span key={at} className="discord-mention">
          @{member.name}
        </span>,
      )
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={at}>{match[2].replace(/\\([\\*_`~|>#[\]()])/g, "$1")}</strong>)
    } else if (match[3]) {
      nodes.push(match[3])
    } else {
      nodes.push(<br key={at} />)
    }
    last = at + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
