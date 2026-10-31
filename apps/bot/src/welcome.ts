import { getGuild, guildGreeting, setGuildGreeting, upsertGuild } from "@iris/db"
import { fillWelcome, greetingDefaults, parseWelcomeMessage, type GreetingKind } from "@iris/shared"
import {
  ComponentType,
  MessageFlags,
  MessageType,
  type ChannelSelectMenuInteraction,
  type Guild,
  type Message,
  type MessageCreateOptions,
  type User,
} from "discord.js"
import { renderWelcomeBanner } from "./banner"
import type { BotEnv } from "./env"
import { channelLabel, ephemeral, manages, memberPermissions, selectedTextChannel } from "./live"
import { present, reply, safe, scene, warn, type Note } from "./reply"

export const WELCOME_PICK_ID = "iris:welcome:pick"
export const BOOST_PICK_ID = "iris:boost:pick"
const BURST_MS = 60_000
const BURST_MAX = 10
const recent = new Map<string, number[]>()

const BOOST_TYPES = new Set<MessageType>([
  MessageType.GuildBoost,
  MessageType.GuildBoostTier1,
  MessageType.GuildBoostTier2,
  MessageType.GuildBoostTier3,
])

const copy: Record<
  GreetingKind,
  {
    kicker: string
    pickId: string
    accent: number
    banners: string
    who: string
    systemOption: string
    placeholders: string
  }
> = {
  welcome: {
    kicker: "👋 Welcome",
    pickId: WELCOME_PICK_ID,
    accent: 0xd7a15f,
    banners: "Welcome banners",
    who: "New members are greeted",
    systemOption: "Send a random welcome message when someone joins this server",
    placeholders: "Use {user} to mention the member, {name} for their name, and {server} for this server.",
  },
  boost: {
    kicker: "💎 Boost",
    pickId: BOOST_PICK_ID,
    accent: 0xff73fa,
    banners: "Boost thank-yous",
    who: "Boosters are thanked",
    systemOption: "Send a message when someone boosts this server",
    placeholders:
      "Use {user} to mention the booster, {name} for their name, {server} for this server, {boosts} for the boost count, and {level} for the server level.",
  },
}

export function greetingKindForMessage(type: MessageType): GreetingKind | null {
  if (type === MessageType.UserJoin) return "welcome"
  if (BOOST_TYPES.has(type)) return "boost"
  return null
}

export async function runGreetingCommand(kind: GreetingKind, message: Message, args: string[], env: BotEnv): Promise<void> {
  const text = copy[kind]
  const guild = message.guild
  if (!guild || !message.channel.isTextBased() || message.channel.isDMBased()) {
    await reply(message, warn("Use a server", `${text.banners} are posted in a server channel.`))
    return
  }
  const action = args[0]?.toLowerCase()
  if (action === "test") {
    await sendPreview(kind, message)
    return
  }
  if (!manages(guild.ownerId, message.author.id, message.member?.permissions ?? null)) {
    await reply(
      message,
      warn("Manage Server needed", `Only the server owner, or a member with Manage Server, can change ${text.banners.toLowerCase()}.`),
    )
    return
  }

  await upsertGuild(guild.id, guild.name)
  if (!action || action === "channel") {
    await showPicker(kind, message)
    return
  }
  if (action === "off" || action === "on") {
    await reply(message, await toggle(kind, guild, action === "on"))
    return
  }
  if (action === "message") {
    await reply(message, await saveMessage(kind, guild, args.slice(1).join(" "), env))
    return
  }
  await reply(message, warn("Unknown option", `Use ${kind}, ${kind} channel, ${kind} off, ${kind} on, ${kind} test, or ${kind} message <text>.`))
}

async function showPicker(kind: GreetingKind, message: Message): Promise<void> {
  const guild = message.guild
  if (!guild) return
  const text = copy[kind]
  const current = guildGreeting(await getGuild(guild.id), kind)
  await reply(message, {
    ...scene(
      text.kicker,
      "Choose a channel",
      [
        kind === "boost"
          ? "Members who boost get a thank-you banner in the channel you choose."
          : "New members get a banner in the channel you choose.",
        `-# Discord's own message must be on: Server Settings → Overview → System Messages → "${text.systemOption}".`,
      ].join("\n"),
    ),
    channelPick: { customId: text.pickId, placeholder: "Choose a channel", channelId: current.channelId ?? undefined },
  })
}

export async function chooseGreetingChannel(kind: GreetingKind, interaction: ChannelSelectMenuInteraction): Promise<void> {
  const text = copy[kind]
  if (!interaction.guild) {
    await interaction.deferUpdate()
    return
  }
  if (!manages(interaction.guild.ownerId, interaction.user.id, memberPermissions(interaction))) {
    await interaction.reply(
      ephemeral(
        interaction.message,
        warn("Manage Server needed", `Only the server owner, or a member with Manage Server, can change ${text.banners.toLowerCase()}.`),
      ),
    )
    return
  }
  const selected = await selectedTextChannel(interaction)
  if (!selected.ok) {
    await interaction.reply(ephemeral(interaction.message, warn("Choose another channel", selected.reason)))
    return
  }
  await upsertGuild(interaction.guild.id, interaction.guild.name)
  await setGuildGreeting(interaction.guild.id, kind, { channelId: selected.channel.id, enabled: true })
  await interaction.update({
    flags: MessageFlags.IsComponentsV2,
    components: present(
      interaction.message,
      scene(
        text.kicker,
        `${text.banners} are on`,
        `${text.who} in ${channelLabel(selected.channel)}.\n-# Try it with **${kind} test**. Change the text with **${kind} message**.`,
      ),
    ).components,
    allowedMentions: { parse: [], repliedUser: false },
  })
}

async function toggle(kind: GreetingKind, guild: Guild, on: boolean): Promise<Note> {
  const text = copy[kind]
  const current = guildGreeting(await getGuild(guild.id), kind)
  if (on && !current.channelId) return warn("No channel yet", `Send ${kind} first to choose a channel.`)
  await setGuildGreeting(guild.id, kind, { enabled: on })
  if (!on) return scene(text.kicker, `${text.banners} are off`, `-# Send ${kind} on to turn them back on.`)
  const where = current.channelId ? channelLabel(guild.channels.cache.get(current.channelId)) : "the chosen channel"
  return scene(text.kicker, `${text.banners} are on`, `${text.who} in ${where}.`)
}

async function saveMessage(kind: GreetingKind, guild: Guild, raw: string, env: BotEnv): Promise<Note> {
  const text = copy[kind]
  if (!raw.trim()) {
    const current = guildGreeting(await getGuild(guild.id), kind)
    return scene(
      text.kicker,
      "Message",
      [
        quote(current.message ?? greetingDefaults[kind]),
        `-# ${text.placeholders}`,
        `-# Send **${kind} message reset** to go back to the default, or edit it at ${env.WEB_ORIGIN}/dashboard`,
      ].join("\n"),
    )
  }
  const reset = raw.trim().toLowerCase() === "reset"
  const parsed = reset ? ({ ok: true, message: null } as const) : parseWelcomeMessage(raw)
  if (!parsed.ok) return warn("Too long", parsed.error)
  await setGuildGreeting(guild.id, kind, { message: parsed.message })
  return scene(
    text.kicker,
    reset ? "Message reset" : "Message saved",
    `${quote(parsed.message ?? greetingDefaults[kind])}\n-# Send **${kind} test** to see it with the banner.`,
  )
}

function quote(value: string): string {
  return `> ${value.replace(/\n/g, "\n> ")}`
}

async function sendPreview(kind: GreetingKind, message: Message): Promise<void> {
  const guild = message.guild
  if (!guild) return
  const current = guildGreeting(await getGuild(guild.id), kind)
  const payload = await greetingPayload(kind, guild, message.author, message.member?.displayName, current.message, true)
  await message.reply({ ...payload, allowedMentions: { parse: [], repliedUser: false } })
}

export async function greetSystemMessage(message: Message): Promise<void> {
  const kind = greetingKindForMessage(message.type)
  if (!kind || !message.guild || message.author.bot) return
  const guild = message.guild
  if (tooBusy(`${kind}:${guild.id}`)) return
  const current = guildGreeting(await getGuild(guild.id), kind)
  if (!current.enabled || !current.channelId) return
  const channel = guild.channels.cache.get(current.channelId) ?? (await guild.channels.fetch(current.channelId).catch(() => null))
  if (!channel?.isSendable()) return
  const payload = await greetingPayload(kind, guild, message.author, message.member?.displayName, current.message, false)
  await channel.send({ ...payload, allowedMentions: { users: [message.author.id] } })
}

async function greetingPayload(
  kind: GreetingKind,
  guild: Guild,
  user: User,
  displayName: string | undefined,
  template: string | null | undefined,
  preview: boolean,
): Promise<MessageCreateOptions> {
  const name = displayName || user.displayName || user.username
  const boosts = guild.premiumSubscriptionCount ?? 0
  const level = guild.premiumTier
  const banner = await renderWelcomeBanner({
    kind,
    name,
    server: guild.name,
    avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
    iconUrl: guild.iconURL({ extension: "png", size: 128 }),
    boosts,
    level,
  })
  const text = fillWelcome(template, { userId: user.id, name, server: guild.name, boosts, level }, kind)
  const file = `${kind}.png`
  return {
    flags: MessageFlags.IsComponentsV2,
    files: [{ attachment: banner, name: file }],
    components: [
      {
        type: ComponentType.Container,
        accentColor: copy[kind].accent,
        components: [
          { type: ComponentType.TextDisplay, content: preview ? `-# Iris  ·  ${copy[kind].kicker} preview\n${text}` : text },
          {
            type: ComponentType.MediaGallery,
            items: [{ media: { url: `attachment://${file}` }, description: `${copy[kind].banners} banner for ${safe(name)}` }],
          },
        ],
      },
    ],
  }
}

function tooBusy(key: string): boolean {
  const now = Date.now()
  const times = (recent.get(key) ?? []).filter((at) => now - at < BURST_MS)
  if (times.length >= BURST_MAX) {
    recent.set(key, times)
    return true
  }
  times.push(now)
  recent.set(key, times)
  if (recent.size > 1000) recent.clear()
  return false
}
