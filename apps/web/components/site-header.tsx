import { InviteLink } from "@/components/invite-link"
import { SessionMenu } from "@/components/session-menu"
import { readInviteUrl } from "@/lib/invite"
import { getSession } from "@/lib/session"
import type { Session } from "@/lib/types"
import Link from "next/link"

function discordAvatarUrl(session: Session): string {
  if (!session.avatar) {
    const index = Number((BigInt(session.userId) >> 22n) % 6n)
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`
  }
  return `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=64`
}

export async function SiteHeader() {
  const session = await getSession()
  const invite = readInviteUrl()

  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        Iris
      </Link>
      <nav>
        <Link href="/commands">Commands</Link>
        <Link href="/dashboard">Dashboard</Link>
        {invite ? (
          <InviteLink className="nav-invite" href={invite}>
            Invite Iris
          </InviteLink>
        ) : null}
        {session ? <SessionMenu name={session.username} avatarUrl={discordAvatarUrl(session)} /> : null}
      </nav>
    </header>
  )
}
