import { commandGroups, commandList, DEFAULT_PREFIX } from "@iris/shared"
import { InviteLink } from "@/components/invite-link"
import { readInviteUrl } from "@/lib/invite"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Commands" }

export default function CommandsPage() {
  const invite = readInviteUrl()

  return (
    <main className="page commands">
      <div className="page-intro">
        <h1>Commands</h1>
        <p>
          The default prefix is {DEFAULT_PREFIX}. A server can change it. Volume on the playback card
          moves by 10%, from 0% to 200%, and starts at 10%.
        </p>
        {invite ? (
          <div className="actions">
            <InviteLink className="button" href={invite}>
              Invite Iris
            </InviteLink>
          </div>
        ) : null}
      </div>
      <div className="command-boards">
        {commandGroups.map((group) => (
          <section key={group.id} className="command-board" aria-label={group.label}>
            <h2>{group.label}</h2>
            <div className="command-list">
              {commandList
                .filter((command) => command.group === group.id)
                .map((command) => (
                  <article key={command.name} className="command">
                    <header>
                      <span className="command-emoji" aria-hidden="true">
                        {command.emoji}
                      </span>
                      <code>
                        {DEFAULT_PREFIX} {command.usage}
                      </code>
                    </header>
                    <p>{command.summary}</p>
                    {command.examples.length > 0 ? (
                      <div className="command-examples">
                        {command.examples.map((example) => (
                          <code key={example}>
                            {DEFAULT_PREFIX} {example}
                          </code>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
