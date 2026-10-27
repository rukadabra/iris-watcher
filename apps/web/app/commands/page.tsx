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
          prefix uses that value instead.
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
