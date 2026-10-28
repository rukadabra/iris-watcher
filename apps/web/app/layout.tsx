import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Fraunces, Outfit } from "next/font/google"
import { InviteLink } from "@/components/invite-link"
import { SiteHeader } from "@/components/site-header"
import { readInviteUrl } from "@/lib/invite"
import "./globals.css"

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" })
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: { default: "Iris", template: "%s · Iris" },
  description: "Iris is a Discord bot for music and YouTube live alerts. The default prefix is !iris, and each server can change it.",
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: { children: ReactNode }) {
  const invite = readInviteUrl()

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <div className="shell">
          <SiteHeader />
          {children}
          <footer className="site-footer">
            {invite ? <InviteLink href={invite}>Invite Iris</InviteLink> : null}
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </footer>
        </div>
      </body>
    </html>
  )
}
