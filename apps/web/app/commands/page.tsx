import { commandGroups, commandList, DEFAULT_PREFIX } from "@iris/shared"
import { InviteLink } from "@/components/invite-link"
import { readInviteUrl } from "@/lib/invite"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Commands" }

export default function CommandsPage() {
  const invite = readInviteUrl()

  return (
    <main className="page">
      <div className="page-intro">
        <h1>Commands</h1>
        <p>
          The examples below use the default prefix {DEFAULT_PREFIX}. A server that changed its
          prefix uses that value instead. <span className="prefix-preview">play baru</span>,{" "}
          <span className="prefix-preview">queue berikutnya</span>, and{" "}
          <span className="prefix-preview">loop satu</span>,{" "}
          <span className="prefix-preview">semua</span>, or{" "}
          <span className="prefix-preview">mati</span> are accepted too.
        </p>
        <p>
          While a song plays, the card has pause, resume, next, stop, queue pages, loop, and volume.
          Down and up move by 10%, from 0% to 200%. 100% is the song's own level. The number belongs
          to that server and starts at 10%.
        </p>
        {invite ? (
          <div className="actions">
            <InviteLink className="button" href={invite}>
              Invite Iris
            </InviteLink>
          </div>
        ) : null}
      </div>
      <div className="command-groups">
        {commandGroups.map((group) => (
          <section key={group.id} className="command-group" aria-label={group.label}>
            <h2>{group.label}</h2>
            <div className="command-list">
              {commandList
                .filter((command) => command.group === group.id)
                .map((command) => (
                  <article key={command.name} className="command">
                    <code>
                      {command.emoji} {DEFAULT_PREFIX} {command.usage}
                    </code>
                    <p>{command.summary}</p>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
