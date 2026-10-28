import { upsertGuild } from "@iris/db"
import { parseCommand } from "@iris/shared"
import { Events, MessageFlags, type ButtonInteraction, type Client, type Message } from "discord.js"
import { commands } from "./commands"
import type { CommandStore } from "./command-store"
import type { BotEnv } from "./env"
import type { PrefixStore } from "./prefix-store"
import { chooseLiveChannel, LIVE_PICK_ID } from "./live"
import { present, reply, safe, warn } from "./reply"
import { adjustVolume, botVoiceChannel, describeQueue, pausePlayback, resumePlayback, skipTrack, stopPlayback, toggleLoop, watchAlone } from "./voice"

const recentCommands = new Map<string, number>()

function isCoolingDown(userId: string): boolean {
  const now = Date.now()
  const previous = recentCommands.get(userId) ?? 0
  if (now - previous < 1000) return true
  recentCommands.set(userId, now)
  if (recentCommands.size > 5000) recentCommands.clear()
  return false
}

async function onMessage(
  message: Message,
  prefixes: PrefixStore,
  commandGate: CommandStore,
  env: BotEnv,
): Promise<void> {
  if (message.author.bot || message.system || !message.guild || !message.content) return

  const prefix = await prefixes.getPrefix(message.guild.id)
  const parsed = parseCommand(message.content, prefix)
  if (!parsed) return

  const command = commands[parsed.name]
  if (!command || isCoolingDown(message.author.id)) return

  try {
    const disabled = await commandGate.disabled(message.guild.id)
    if (disabled.has(parsed.name)) {
      await reply(
        message,
        warn(
          "Command off",
          `**${safe(prefix)} ${safe(parsed.name)}** is off for this server.\n-# A manager can turn it on from the dashboard.`,
        ),
      )
      return
    }
    await command.execute({ message, args: parsed.args, prefix, env, disabled })
  } catch (error) {
    console.error(`Command ${parsed.name} failed in ${message.guild.id}`, error)
  }
}

async function onButton(interaction: ButtonInteraction, commandGate: CommandStore): Promise<void> {
  const [scope, action, extra] = interaction.customId.split(":")
  if (scope !== "iris" || !action || !interaction.guildId || !interaction.message) return
  if (isCoolingDown(interaction.user.id)) {
    await interaction.deferUpdate()
    return
  }

  const guildId = interaction.guildId
  const commandName = action === "page" ? "queue" : action
  if (commandName === "pause" || commandName === "resume" || commandName === "next" || commandName === "stop" || commandName === "loop" || commandName === "queue") {
    const disabled = await commandGate.disabled(guildId)
    if (disabled.has(commandName)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: present(
          interaction.message,
          warn("Command off", "This control is off for this server. A manager can turn it on from the dashboard."),
        ).components,
        allowedMentions: { parse: [], repliedUser: false },
      })
      return
    }
  }

  if (action === "page") {
    const page = Number(extra)
    if (!Number.isInteger(page)) {
      await interaction.deferUpdate()
      return
    }
    await interaction.update({
      flags: MessageFlags.IsComponentsV2,
      components: present(interaction.message, describeQueue(guildId, page)).components,
      allowedMentions: { parse: [], repliedUser: false },
    })
    return
  }

  const playback = action === "pause" || action === "resume" || action === "stop" || action === "next" || action === "loop" || action === "volume"
  if (!playback) {
    await interaction.deferUpdate()
    return
  }

  const memberChannel = interaction.member && "voice" in interaction.member ? interaction.member.voice.channelId : null
  const botChannel = botVoiceChannel(guildId)
  if (!botChannel || memberChannel !== botChannel) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      components: present(
        interaction.message,
        warn("Join voice first", "Use this button from the voice channel Iris is in."),
      ).components,
      allowedMentions: { parse: [], repliedUser: false },
    })
    return
  }

  if (action === "loop" && extra !== "one" && extra !== "all") {
    await interaction.deferUpdate()
    return
  }
  if (action === "volume" && extra !== "up" && extra !== "down") {
    await interaction.deferUpdate()
    return
  }

  const result =
    action === "pause"
      ? pausePlayback(guildId)
      : action === "resume"
        ? resumePlayback(guildId)
        : action === "stop"
          ? stopPlayback(guildId)
          : action === "loop"
            ? toggleLoop(guildId, extra === "all" ? "all" : "one")
            : action === "volume"
              ? adjustVolume(guildId, extra === "up" ? "up" : "down")
              : skipTrack(guildId)

  if (result.tone === "warn") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      components: present(interaction.message, result).components,
      allowedMentions: { parse: [], repliedUser: false },
    })
    return
  }
  await interaction.update({
    flags: MessageFlags.IsComponentsV2,
    components: present(interaction.message, result).components,
    allowedMentions: { parse: [], repliedUser: false },
  })
}

export function registerEvents(client: Client, prefixes: PrefixStore, commandGate: CommandStore, env: BotEnv): void {
  client.on(Events.ClientReady, (readyClient) => {
    void (async () => {
      for (const guild of readyClient.guilds.cache.values()) {
        await upsertGuild(guild.id, guild.name)
      }
      console.info(
        `Iris is online as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} servers`,
      )
    })().catch((error: unknown) => console.error(error))
  })

  client.on(Events.GuildCreate, (guild) => {
    void upsertGuild(guild.id, guild.name).catch((error: unknown) => console.error(error))
  })

  client.on(Events.GuildUpdate, (_previous, guild) => {
    void upsertGuild(guild.id, guild.name).catch((error: unknown) => console.error(error))
  })

  client.on(Events.MessageCreate, (message) => {
    void onMessage(message, prefixes, commandGate, env)
  })

  client.on(Events.VoiceStateUpdate, (previous, next) => {
    const channelId = botVoiceChannel(next.guild.id)
    if (!channelId) return
    if (previous.channelId !== channelId && next.channelId !== channelId) return
    watchAlone(next.guild.id)
  })

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId !== LIVE_PICK_ID) return
      void chooseLiveChannel(interaction, env).catch((error: unknown) => console.error(error))
      return
    }
    if (!interaction.isButton()) return
    void onButton(interaction, commandGate).catch((error: unknown) => console.error(error))
  })
}
