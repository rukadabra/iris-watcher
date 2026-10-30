import { classifyPlayArgs, commandGroups, commandList, inviteUrl } from "@iris/shared"
import type { Message } from "discord.js"
import { askCommand, sendAsk, type AskResult } from "./ask"
import type { BotEnv } from "./env"
import { animeLookup, defineLookup, hnLookup, lyricsLookup, newsLookup, rateLookup, triviaLookup, weatherLookup, wikiLookup } from "./lookups"
import { searchRemoteTrack } from "./player-client"
import { runLiveCommand } from "./live"
import { sendTo } from "./output"
import { runGreetingCommand } from "./welcome"
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
  intro?: string
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
  welcome: {
    async execute({ message, args, env }) {
      await runGreetingCommand("welcome", message, args, env)
    },
  },
  boost: {
    async execute({ message, args, env }) {
      await runGreetingCommand("boost", message, args, env)
    },
  },
  live: {
    async execute({ message, args, env }) {
      await runLiveCommand(message, args, env)
    },
  },
  join: {
    async execute({ message, intro }) {
      await sendTo(message, "music", await joinVoice(message), intro)
    },
  },
  play: {
    async execute({ message, args, env, intro }) {
      const request = classifyPlayArgs(args)
      if (request.kind === "search") {
        if (!request.query) {
          await sendTo(message, "music", attachControls(message.guild?.id ?? "", warn("No title yet", "Send a song title or a YouTube link.")), intro)
          return
        }
        const found = await searchRemoteTrack(env, request.query)
        if (!found.ok) {
          await sendTo(message, "music", attachControls(message.guild?.id ?? "", warn("YouTube", found.error)), intro)
          return
        }
        await sendTo(
          message,
          "music",
          await playYoutube(message, env, [{ type: "video", id: found.track.id }], request.fresh),
          intro,
        )
        return
      }
      await sendTo(message, "music", await playYoutube(message, env, request.items, request.fresh), intro)
    },
  },
  queue: {
    async execute({ message, args, intro }) {
      const guildId = message.guild?.id ?? ""
      const arg = args[0]?.toLowerCase()
      if (!arg) {
        await sendTo(message, "music", describeQueue(guildId, 1), intro)
        return
      }
      if (arg === "berikutnya" || arg === "next") {
        await sendTo(message, "music", describeQueue(guildId, "next"), intro)
        return
      }
      if (arg === "sebelumnya" || arg === "prev") {
        await sendTo(message, "music", describeQueue(guildId, "prev"), intro)
        return
      }
      if (/^\d+$/.test(arg)) {
        await sendTo(message, "music", describeQueue(guildId, Number(arg)), intro)
        return
      }
      await reply(
        message,
        attachControls(guildId, warn("Unknown page", "Send a page number, next, or previous.")),
      )
    },
  },
  pause: {
    async execute({ message, intro }) {
      await sendTo(message, "music", pausePlayback(message.guild?.id ?? ""), intro)
    },
  },
  resume: {
    async execute({ message, intro }) {
      await sendTo(message, "music", resumePlayback(message.guild?.id ?? ""), intro)
    },
  },
  next: {
    async execute({ message, intro }) {
      await sendTo(message, "music", skipTrack(message.guild?.id ?? ""), intro)
    },
  },
  skip: {
    async execute({ message, intro }) {
      await sendTo(message, "music", skipTrack(message.guild?.id ?? ""), intro)
    },
  },
  loop: {
    async execute({ message, args, intro }) {
      const guildId = message.guild?.id ?? ""
      const arg = args[0]?.toLowerCase()
      if (!arg) {
        await sendTo(message, "music", loopStatus(guildId), intro)
        return
      }
      const mode =
        arg === "satu" || arg === "one" ? "one" : arg === "semua" || arg === "all" ? "all" : arg === "mati" || arg === "off" ? "off" : null
      if (!mode) {
        await sendTo(message, "music", attachControls(guildId, warn("Unknown loop", "Use one, all, or off.")), intro)
        return
      }
      await sendTo(message, "music", setLoop(guildId, mode), intro)
    },
  },
  stop: {
    async execute({ message, intro }) {
      await sendTo(message, "music", stopPlayback(message.guild?.id ?? ""), intro)
    },
  },
  leave: {
    async execute({ message, intro }) {
      await sendTo(message, "music", leaveVoice(message.guild?.id ?? ""), intro)
    },
  },
  lyrics: {
    async execute({ message, args, intro }) {
      const typed = args.join(" ").trim()
      const guildId = message.guild?.id ?? ""
      const query = typed || playingTitle(guildId) || ""
      const fromQueue = !typed && Boolean(query)
      await sendTo(message, "lyrics", await lyricsLookup(query, fromQueue, fromQueue ? playingArtwork(guildId) : null), intro)
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
  ask: {
    async execute({ message, args, prefix, env, disabled }) {
      await answerChat({ message, prefix, env, disabled }, await askCommand(message, args.join(" "), prefix, env))
    },
  },
}

export async function answerChat(context: Omit<CommandContext, "args">, result: AskResult): Promise<void> {
  if (result.type !== "action") {
    await sendAsk(context.message, result)
    return
  }
  const { command, args } = result.action
  const target = commands[command]
  if (!target) return
  if (context.disabled.has(command)) {
    await reply(
      context.message,
      warn(
        "Command off",
        `**${safe(context.prefix)} ${safe(command)}** is off for this server.\n-# A manager can turn it on from the dashboard.`,
      ),
    )
    return
  }
  await target.execute({ ...context, args, intro: result.intro })
}

function uptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${Math.max(1, minutes)}m`
}
