import { DEFAULT_PREFIX } from "@iris/shared"
import { InviteLink } from "@/components/invite-link"
import { readInviteUrl } from "@/lib/invite"
import { readStats } from "@/lib/stats"
import Image from "next/image"

const tools = [
  {
    title: "Discord",
    items: [
      ["discord.js", "Gateway, messages, and buttons"],
      ["@discordjs/voice", "The voice connection"],
      ["opusscript", "Opus for the song you hear"],
      ["@snazzah/davey", "DAVE, included with the voice package"],
    ],
  },
  {
    title: "YouTube",
    items: [
      ["yt-dlp", "Reads a video, playlist, or channel"],
      ["ffmpeg", "Prepares the audio on the player"],
    ],
  },
  {
    title: "Website",
    items: [
      ["Next.js", "This site and the dashboard"],
      ["React", "The pages"],
      ["TypeScript", "The codebase"],
    ],
  },
  {
    title: "Data",
    items: [
      ["PostgreSQL", "Prefix, alerts, commands, and volume"],
      ["Redis", "Cache, sign-in sessions, and status"],
      ["Drizzle", "How the bot and site read Postgres"],
    ],
  },
  {
    title: "Runtime",
    items: [
      ["Node.js", "24.17 or newer"],
      ["pnpm", "Installs the packages"],
    ],
  },
  {
    title: "Lookups",
    items: [
      ["LRCLIB", "Lyrics for a song"],
      ["Open-Meteo", "Weather by city"],
      ["Wikipedia", "A short page summary"],
      ["Free Dictionary", "An English definition"],
      ["Frankfurter", "A daily exchange rate"],
      ["AniList", "Anime by title"],
      ["Open Trivia DB", "One trivia question"],
      ["Bing News", "Headlines for a topic"],
      ["Hacker News", "Front page, or a search"],
    ],
  },
  {
    title: "Deploy",
    items: [
      ["Docker", "Postgres, Redis, and the images"],
      ["Dokploy", "Runs the public site"],
    ],
  },
] as const

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
          <p>Every invite adds its own server. That server keeps its own prefix.</p>
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
            or a playlist link become a queue. If the channel stays empty for a minute, Iris leaves.
          </p>
        </article>
        <article className="point">
          <h2>On the playback card</h2>
          <p>
            Pause, skip, loop, and volume sit on the card. Down and up move by 10%, from 0% to 200%.
            100% is the song's own level. Each server keeps its number, and a server that has never
            changed it starts at 10%.
          </p>
        </article>
        <article className="point">
          <h2>Live alerts</h2>
          <p>
            A manager can watch up to 50 YouTube channels and pick the text channel that receives the
            card. The list belongs to that server.
          </p>
        </article>
        <article className="point">
          <h2>Lookups</h2>
          <p>
            Lyrics, weather, a Wikipedia summary, an English definition, a daily exchange rate, an
            anime title, trivia, headlines, and Hacker News. These calls need no token.
          </p>
        </article>
      </section>
      <section className="band" aria-labelledby="tools-heading">
        <div className="band-copy">
          <p className="eyebrow">Tools</p>
          <h2 id="tools-heading">What Iris runs on</h2>
          <p>
            The bot talks to Discord, the player reads YouTube, and this site holds the dashboard.
          </p>
        </div>
        <div className="points">
          {tools.map((group) => (
            <article key={group.title} className="point">
              <h2>{group.title}</h2>
              <ul className="tool-list">
                {group.items.map(([name, role]) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <span>{role}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
