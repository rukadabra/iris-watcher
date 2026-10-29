import { classifyPlayArgs, commandGroups, commandList, inviteUrl } from "@iris/shared"
import type { Message } from "discord.js"
import type { BotEnv } from "./env"
import { animeLookup, defineLookup, hnLookup, lyricsLookup, newsLookup, rateLookup, triviaLookup, weatherLookup, wikiLookup } from "./lookups"
import { searchRemoteTrack } from "./player-client"
import { runLiveCommand } from "./live"
import { editReply, note, reply, safe, scene, warn } from "./reply"
import {
  attachControls,
  describeQueue,
  joinVoice,
  leaveVoice,
  loopStatus,
  pausePlayback,
  playingArtwork,
  playingTitle,
  playYoutube,
  resumePlayback,
  setLoop,
  skipTrack,
  stopPlayback,
} from "./voice"

const IRIS_GOLD = 0xd7a15f

export type CommandContext = {
  message: Message
  args: string[]
  prefix: string
  env: BotEnv
  disabled: ReadonlySet<string>
}

export type BotCommand = {
  execute: (context: CommandContext) => Promise<void>
}

export const commands: Record<string, BotCommand> = {
  help: {
    async execute({ message, prefix, env, disabled }) {
      const shown = commandList.filter((command) => !disabled.has(command.name))
      const hidden = commandList.length - shown.length
      const footer =
        hidden === 0
          ? ""
          : `\n-# ${hidden === 1 ? "1 command is" : `${hidden} commands are`} off for this server. A manager can turn them on from the dashboard.`
      const grouped = commandGroups
        .map((group) => {
          const lines = shown
            .filter((command) => command.group === group.id)
            .map((command) => `**${command.emoji}  ${safe(prefix)} ${command.usage}**\n-# ${command.summary}`)
          return lines.length === 0 ? "" : `**${group.label}**\n${lines.join("\n")}`
        })
        .filter(Boolean)
        .join("\n\n")
      await reply(
        message,
        note(
          "📖 Commands",
          `This server's prefix is **${safe(prefix)}**.\n-# Change it at ${env.WEB_ORIGIN}/dashboard\n\n${grouped}${footer}`,
        ),
      )
    },
  },
  about: {
    async execute({ message, prefix, env }) {
      const { client } = message
      const stats = [
        `🏠 **${client.guilds.cache.size}** ${client.guilds.cache.size === 1 ? "server" : "servers"}`,
        `⏱️ up **${uptime(client.uptime ?? 0)}**`,
        `📡 **${Math.max(0, Math.round(client.ws.ping))} ms**`,
      ].join("  ·  ")
      await reply(message, {
        kicker: "🌿 About",
        title: "Hi, I'm Iris",
        description: [
          "I keep your server company. I play music in voice, tell you when a channel goes live, and answer quick questions without anyone leaving Discord.",
          stats,
        ].join("\n\n"),
        fields: [
          {
            name: "🎵 Listen together",
            value: "Play a title, a link, or a whole playlist. When the queue runs low, I keep it going with songs that fit.",
          },
          {
            name: "🔴 Never miss a stream",
            value: "Follow up to 50 YouTube channels, and I post a card the moment one of them goes live.",
          },
          {
            name: "🔎 Ask me anything quick",
            value: "Lyrics, weather, Wikipedia, word meanings, exchange rates, anime, trivia, news, and Hacker News.",
          },
          {
            name: "⚙️ Your server, your way",
            value: "Each server picks its own prefix, alert list, and commands from the dashboard.",
          },
        ],
        thumbnail: client.user?.displayAvatarURL({ extension: "png", size: 256 }),
        accent: IRIS_GOLD,
        footer: `Start with ${safe(prefix)} help  ·  Made with care by Gede Krisna ([atsuki](https://discord.com/users/193344047895674880))`,
        links: [
          ...(client.user ? [{ label: "Invite Iris", url: inviteUrl(client.user.id) }] : []),
          { label: "Website", url: env.WEB_ORIGIN },
          { label: "Dashboard", url: `${env.WEB_ORIGIN}/dashboard` },
          { label: "GitHub", url: "https://github.com/rukadabra" },
        ],
      })
    },
  },
  ping: {
    async execute({ message }) {
      const sent = await reply(message, note("🏓 Ping", "-# Measuring the path to Discord."))
      const roundTrip = sent.createdTimestamp - message.createdTimestamp
      const gateway = Math.round(message.client.ws.ping)
      await editReply(sent, scene("🏓 Pong", `${gateway} ms`, `-# Reply **${roundTrip} ms**.`))
    },
  },
  prefix: {
    async execute({ message, prefix, env }) {
      await reply(
        message,
        scene("✏️ Prefix", safe(prefix), `-# Change it at ${env.WEB_ORIGIN}/dashboard`),
      )
    },
  },
  live: {
    async execute({ message, args, env }) {
      await runLiveCommand(message, args, env)
    },
  },
  join: {
    async execute({ message }) {
      await reply(message, await joinVoice(message))
    },
  },
  play: {
    async execute({ message, args, env }) {
      const request = classifyPlayArgs(args)
      if (request.kind === "search") {
        if (!request.query) {
          await reply(message, attachControls(message.guild?.id ?? "", warn("No title yet", "Send a song title or a YouTube link.")))
          return
        }
        const found = await searchRemoteTrack(env, request.query)
        if (!found.ok) {
          await reply(message, attachControls(message.guild?.id ?? "", warn("YouTube", found.error)))
          return
        }
        await reply(
          message,
          await playYoutube(message, env, [{ type: "video", id: found.track.id }], request.fresh),
        )
        return
      }
      await reply(message, await playYoutube(message, env, request.items, request.fresh))
    },
  },
  queue: {
    async execute({ message, args }) {
      const guildId = message.guild?.id ?? ""
      const arg = args[0]?.toLowerCase()
      if (!arg) {
        await reply(message, describeQueue(guildId, 1))
        return
      }
      if (arg === "berikutnya" || arg === "next") {
        await reply(message, describeQueue(guildId, "next"))
        return
      }
      if (arg === "sebelumnya" || arg === "prev") {
        await reply(message, describeQueue(guildId, "prev"))
        return
      }
      if (/^\d+$/.test(arg)) {
        await reply(message, describeQueue(guildId, Number(arg)))
        return
      }
      await reply(
        message,
        attachControls(guildId, warn("Unknown page", "Send a page number, next, or previous.")),
      )
    },
  },
  pause: {
    async execute({ message }) {
      await reply(message, pausePlayback(message.guild?.id ?? ""))
    },
  },
  resume: {
    async execute({ message }) {
      await reply(message, resumePlayback(message.guild?.id ?? ""))
    },
  },
  next: {
    async execute({ message }) {
      await reply(message, skipTrack(message.guild?.id ?? ""))
    },
  },
  skip: {
    async execute({ message }) {
      await reply(message, skipTrack(message.guild?.id ?? ""))
    },
  },
  loop: {
    async execute({ message, args }) {
      const guildId = message.guild?.id ?? ""
      const arg = args[0]?.toLowerCase()
      if (!arg) {
        await reply(message, loopStatus(guildId))
        return
      }
      const mode =
        arg === "satu" || arg === "one" ? "one" : arg === "semua" || arg === "all" ? "all" : arg === "mati" || arg === "off" ? "off" : null
      if (!mode) {
        await reply(message, attachControls(guildId, warn("Unknown loop", "Use one, all, or off.")))
        return
      }
      await reply(message, setLoop(guildId, mode))
    },
  },
  stop: {
    async execute({ message }) {
      await reply(message, stopPlayback(message.guild?.id ?? ""))
    },
  },
  leave: {
    async execute({ message }) {
      await reply(message, leaveVoice(message.guild?.id ?? ""))
    },
  },
  lyrics: {
    async execute({ message, args }) {
      const typed = args.join(" ").trim()
      const guildId = message.guild?.id ?? ""
      const query = typed || playingTitle(guildId) || ""
      const fromQueue = !typed && Boolean(query)
      await reply(message, await lyricsLookup(query, fromQueue, fromQueue ? playingArtwork(guildId) : null))
    },
  },
  weather: {
    async execute({ message, args }) {
      await reply(message, await weatherLookup(args.join(" ")))
    },
  },
  wiki: {
    async execute({ message, args }) {
      await reply(message, await wikiLookup(args.join(" ")))
    },
  },
  define: {
    async execute({ message, args }) {
      await reply(message, await defineLookup(args.join(" ")))
    },
  },
  rate: {
    async execute({ message, args }) {
      await reply(message, await rateLookup(args))
    },
  },
  anime: {
    async execute({ message, args }) {
      await reply(message, await animeLookup(args.join(" ")))
    },
  },
  trivia: {
    async execute({ message }) {
      await reply(message, await triviaLookup())
    },
  },
  news: {
    async execute({ message, args }) {
      await reply(message, await newsLookup(args.join(" ")))
    },
  },
  hn: {
    async execute({ message, args }) {
      await reply(message, await hnLookup(args.join(" ")))
    },
  },
}

function uptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${Math.max(1, minutes)}m`
}
