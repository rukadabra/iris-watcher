import { DEFAULT_PREFIX } from "@iris/shared"
import { InviteLink } from "@/components/invite-link"
import { readInviteUrl } from "@/lib/invite"
import { readStats } from "@/lib/stats"
import Image from "next/image"

export default async function HomePage() {
  const stats = await readStats()
  const invite = readInviteUrl()

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Discord bot</p>
          <h1>Iris.</h1>
          <p className="lede">
            Her name comes from this character. Iris can join many servers at once. Commands are
            plain text, and the default is <span className="prefix-preview">{DEFAULT_PREFIX}</span>.
            Each server's admin changes the prefix from the dashboard, and other servers stay as they are.
          </p>
          <div className="actions">
            {invite ? (
            <InviteLink className="button" href={invite}>
              Invite Iris
            </InviteLink>
            ) : null}
            <a className="button quiet" href="/commands">
              Command list
            </a>
          </div>
        </div>
        <figure className="hero-portrait">
          <Image
            src="/assets/images/iris.jpg"
            alt="Iris"
            width={720}
            height={720}
            loading="eager"
            fetchPriority="high"
          />
        </figure>
      </section>
      <section className="stats" aria-label="Iris status">
        <div className="stat">
          <span>Default prefix</span>
          <strong>{DEFAULT_PREFIX}</strong>
        </div>
        <div className="stat">
          <span>Status</span>
          <strong className={stats?.online ? undefined : "offline"}>
            {stats?.online ? "Online" : "Offline"}
          </strong>
        </div>
        <div className="stat">
          <span>{stats?.online ? "Servers" : "Last server count"}</span>
          <strong>{stats ? stats.guilds.toLocaleString("en-US") : "—"}</strong>
        </div>
      </section>
      <section className="points">
        <article className="point">
          <h2>One bot, many servers</h2>
          <p>Every invite adds its own server. Prefix settings are not shared.</p>
        </article>
        <article className="point">
          <h2>Prefix commands</h2>
          <p>
            With the default, type <span className="prefix-preview">{DEFAULT_PREFIX} help</span>.
            A prefix that ends in a symbol can sit against the command, such as <span className="prefix-preview">!help</span>.
          </p>
        </article>
        <article className="point">
          <h2>Changed on the web</h2>
          <p>
            Sign in with Discord. A server manager can change the prefix, the YouTube list, and which
            commands are on.
          </p>
        </article>
        <article className="point">
          <h2>Music in voice</h2>
          <p>
            A song title is searched on YouTube, then Iris continues to the next song. Several links
            or a playlist link become a queue.
          </p>
        </article>
      </section>
    </main>
  )
}
