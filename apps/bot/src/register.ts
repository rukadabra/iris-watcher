import { upsertGuild } from "@iris/db"
import { parseCommand } from "@iris/shared"
import { Events, MessageFlags, type ButtonInteraction, type Client, type Message } from "discord.js"
import { askCommand, isAskAnswer, sendAsk } from "./ask"
import { commands } from "./commands"
import type { CommandStore } from "./command-store"
import type { BotEnv } from "./env"
import type { PrefixStore } from "./prefix-store"
import { chooseLiveChannel, LIVE_PICK_ID } from "./live"
import { present, reply, safe, warn } from "./reply"
import { BOOST_PICK_ID, chooseGreetingChannel, greetingKindForMessage, greetSystemMessage, WELCOME_PICK_ID } from "./welcome"
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
  if (!parsed) {
    const botId = message.client.user.id
    const tagged = message.mentions.users.has(botId)
    const replyToBot = Boolean(message.reference?.messageId && message.mentions.repliedUser?.id === botId)
    if (tagged || replyToBot) await onChat(message, prefix, commandGate, env, { tagged, replyToBot })
    return
  }

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

async function onChat(
  message: Message,
  prefix: string,
  commandGate: CommandStore,
  env: BotEnv,
  how: { tagged: boolean; replyToBot: boolean },
): Promise<void> {
  if (!message.guildId) return
  try {
    if (how.replyToBot) {
      const earlier = await message.fetchReference().catch(() => null)
      if (!earlier || !isAskAnswer(earlier)) {
        if (!how.tagged) return
      }
    }
    if (isCoolingDown(message.author.id)) return
    const disabled = await commandGate.disabled(message.guildId)
    if (disabled.has("ask")) return
    await sendAsk(message, await askCommand(message, message.content, prefix, env, { ping: how.tagged }))
  } catch (error) {
    console.error(`A chat reply failed in ${message.guildId}`, error)
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
    action === "volume"
      ? await adjustVolume(guildId, extra === "up" ? "up" : "down")
      : action === "pause"
        ? pausePlayback(guildId)
        : action === "resume"
          ? resumePlayback(guildId)
          : action === "stop"
            ? stopPlayback(guildId)
            : action === "loop"
              ? toggleLoop(guildId, extra === "all" ? "all" : "one")
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
    if (greetingKindForMessage(message.type)) {
      void greetSystemMessage(message).catch((error: unknown) => console.error("Greeting failed", error))
      return
    }
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
      if (interaction.customId === WELCOME_PICK_ID || interaction.customId === BOOST_PICK_ID) {
        const kind = interaction.customId === BOOST_PICK_ID ? "boost" : "welcome"
        void chooseGreetingChannel(kind, interaction).catch((error: unknown) => console.error(error))
        return
      }
      if (interaction.customId !== LIVE_PICK_ID) return
      void chooseLiveChannel(interaction, env).catch((error: unknown) => console.error(error))
      return
    }
    if (!interaction.isButton()) return
    void onButton(interaction, commandGate).catch((error: unknown) => console.error(error))
  })
}
