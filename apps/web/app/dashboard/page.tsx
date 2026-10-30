import {
  guildGreeting,
  listGuildAiByIds,
  migrate,
  listGuildsByIds,
  listLiveWatchesByGuildIds,
  type GreetingSettings,
  type GuildAiSummary,
  type LiveWatch,
} from "@iris/db"
import {
  canManageGuild,
  commandGroups,
  commandList,
  GREETING_KINDS,
  greetingDefaults,
  inviteUrl,
  isToggleableCommand,
  WELCOME_MESSAGE_MAX,
} from "@iris/shared"
import Image from "next/image"
import { AiPanel } from "@/components/ai-panel"
import { InviteLink } from "@/components/invite-link"
import { PrefixForm } from "@/components/prefix-form"
import { CommandPanel, GreetingPanel, WatchPanel } from "@/components/server-tools"
import { fetchDiscordGuilds, fetchGuildBoosts, fetchGuildTextChannels } from "@/lib/discord"
import { readAiKeys, readWebEnv } from "@/lib/env"
import { getSession } from "@/lib/session"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Dashboard" }

const errorCopy: Record<string, string> = {
  oauth: "Discord sign-in failed. Try again.",
  state: "The sign-in session is not valid. Try again.",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error ? errorCopy[params.error] : undefined
  const config = readWebEnv()

  if (!config.ok) {
    return (
      <main className="page dash">
        <h1>Dashboard</h1>
        <p className="dash-lead">{config.error}</p>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    return (
      <main className="page dash">
        <h1>Dashboard</h1>
        <p className="dash-lead">
          Sign in with Discord to manage a server's prefix, YouTube alerts, welcome and boost banners, and commands.
        </p>
        {error ? <p className="notice">{error}</p> : null}
        <div className="actions">
          <a className="button" href="/api/auth/discord">
            Sign in with Discord
          </a>
        </div>
      </main>
    )
  }

  let installed: Array<{
    id: string
    name: string
    icon: string | null
    prefix: string | null
    liveChannelId: string | null
    disabledCommands: string[]
    welcome: GreetingSettings
    boost: GreetingSettings
  }> = []
  let missing: Array<{ id: string; name: string; icon: string | null }> = []
  let watches: LiveWatch[] = []
  let textChannels = new Map<string, Array<{ id: string; name: string }>>()
  let boosts = new Map<string, { boosts: number; level: number }>()
  let aiSettings = new Map<string, Omit<GuildAiSummary, "guildId">>()
  const aiKeys = readAiKeys()
  const aiReady = aiKeys.ok && aiKeys.ring !== null
  let loadError = ""

  try {
    process.env.DATABASE_URL = config.env.DATABASE_URL
    await migrate()
    const guilds = await fetchDiscordGuilds(session.accessToken)
    const manageable = guilds.filter((guild) => canManageGuild(guild.permissions, guild.owner))
    const rows = await listGuildsByIds(manageable.map((guild) => guild.id))
    const known = new Map(rows.map((row) => [row.id, row]))
    installed = manageable
      .filter((guild) => known.has(guild.id))
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        prefix: known.get(guild.id)?.prefix ?? null,
        liveChannelId: known.get(guild.id)?.liveChannelId ?? null,
        disabledCommands: known.get(guild.id)?.disabledCommands ?? [],
        welcome: guildGreeting(known.get(guild.id) ?? null, "welcome"),
        boost: guildGreeting(known.get(guild.id) ?? null, "boost"),
      }))
    missing = manageable
      .filter((guild) => !known.has(guild.id))
      .map((guild) => ({ id: guild.id, name: guild.name, icon: guild.icon }))
    watches = await listLiveWatchesByGuildIds(installed.map((guild) => guild.id))
    const [listed, boosted] = await Promise.all([
      Promise.all(installed.map(async (guild) => [guild.id, await fetchGuildTextChannels(guild.id)] as const)),
      Promise.all(installed.map(async (guild) => [guild.id, await fetchGuildBoosts(guild.id)] as const)),
    ])
    textChannels = new Map(listed)
    boosts = new Map(boosted)
    const ai = await listGuildAiByIds(installed.map((guild) => guild.id))
    aiSettings = new Map(
      ai.map(({ guildId, ...setting }) => [guildId, setting]),
    )  } catch (cause) {
    console.error(cause)
    loadError = "The server list could not be loaded. Sign in again."
  }

  const invite = inviteUrl(config.env.DISCORD_CLIENT_ID)
  const avatarUrl = session.avatar
    ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(session.userId) >> 22n) % 6n)}.png`

  return (
    <main className="page dash">
      <div className="dash-bar">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-lead">Prefix, YouTube alerts, welcome and boost banners, and commands for the servers you manage.</p>
        </div>
      </div>
      {error ? <p className="notice">{error}</p> : null}
      {loadError ? <p className="notice">{loadError}</p> : null}

      {installed.length === 0 && missing.length === 0 && !loadError ? (
        <p>This account does not manage any servers.</p>
      ) : null}

      {installed.length > 0 ? (
        <section className="server-list" aria-label="Servers with Iris">
          {installed.map((guild) => {
            const prefix = guild.prefix ?? config.env.DEFAULT_PREFIX
            const member = {
              userId: session.userId,
              name: session.username,
              avatarUrl,
              server: guild.name,
              iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null,
              ...(boosts.get(guild.id) ?? { boosts: 0, level: 0 }),
            }
            return (
              <article key={guild.id} className="server">
                <header className="server-head">
                  <GuildMark id={guild.id} icon={guild.icon} name={guild.name} />
                  <div>
                    <h2>{guild.name}</h2>
                    <p className="meta">
                      Command <span className="prefix-preview">{prefix} help</span>
                    </p>
                  </div>
                </header>
                <div className="server-grid">
                  <section className="block" aria-label="Prefix">
                    <div className="block-head">
                      <h3>Prefix</h3>
                    </div>
                    <p className="meta">Used on the next message.</p>
                    <PrefixForm key={guild.prefix ?? "default"} guildId={guild.id} prefix={prefix} />
                  </section>
                  <WatchPanel
                    guildId={guild.id}
                    channelId={guild.liveChannelId}
                    channelName={textChannels.get(guild.id)?.find((channel) => channel.id === guild.liveChannelId)?.name}
                    channels={textChannels.get(guild.id) ?? []}
                    watches={watches
                      .filter((watch) => watch.guildId === guild.id)
                      .sort((left, right) => {
                        const on = Number(right.enabled) - Number(left.enabled)
                        if (on) return on
                        const live = Number(Boolean(right.liveVideoId)) - Number(Boolean(left.liveVideoId))
                        return live || left.name.localeCompare(right.name, "en")
                      })
                      .map((watch) => ({
                        youtubeChannelId: watch.youtubeChannelId,
                        name: watch.name,
                        enabled: watch.enabled,
                        liveVideoId: watch.liveVideoId,
                      }))}
                  />
                </div>
                <div className="server-grid greeting-grid">
                  {GREETING_KINDS.map((kind) => {
                    const settings = kind === "boost" ? guild.boost : guild.welcome
                    return (
                      <GreetingPanel
                        key={kind}
                        kind={kind}
                        guildId={guild.id}
                        channelId={settings.channelId}
                        channelName={textChannels.get(guild.id)?.find((channel) => channel.id === settings.channelId)?.name}
                        channels={textChannels.get(guild.id) ?? []}
                        enabled={settings.enabled}
                        message={settings.message}
                        defaultMessage={greetingDefaults[kind]}
                        maxLength={WELCOME_MESSAGE_MAX}
                        member={member}
                      />
                    )
                  })}
                </div>
                <AiPanel
                  guildId={guild.id}
                  ready={aiReady}
                  saved={aiSettings.get(guild.id) ?? null}
                  channels={textChannels.get(guild.id) ?? []}
                />
                <CommandPanel
                  guildId={guild.id}
                  groups={commandGroups.map((group) => ({ id: group.id, label: group.label }))}
                  commands={commandList.map((command) => ({
                    name: command.name,
                    emoji: command.emoji,
                    summary: command.summary,
                    group: command.group,
                    locked: !isToggleableCommand(command.name),
                  }))}
                  disabled={guild.disabledCommands}
                />
              </article>
            )
          })}
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className="dash-section" aria-label="Servers without Iris">
          <h2>Not installed</h2>
          <p className="meta">Iris is not in these servers yet.</p>
          <div className="missing-list">
            {missing.map((guild) => (
              <article key={guild.id} className="missing-row">
                <GuildMark id={guild.id} icon={guild.icon} name={guild.name} />
                <h3>{guild.name}</h3>
                <InviteLink className="button" href={invite}>
                  Invite
                </InviteLink>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function GuildMark({ id, icon, name }: { id: string; icon: string | null; name: string }) {
  if (!icon) {
    return <span className="guild-fallback">{name.slice(0, 1).toUpperCase()}</span>
  }
  return (
    <Image
      className="guild-icon"
      src={`https://cdn.discordapp.com/icons/${id}/${icon}.png`}
      alt=""
      width={48}
      height={48}
    />
  )
}
