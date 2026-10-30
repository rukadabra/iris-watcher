import { getGuildOutputChannel, type OutputKind } from "@iris/db"
import { PermissionFlagsBits, type Message, type SendableChannels } from "discord.js"
import { deliver, reply, type Note } from "./reply"

const INTRO_MAX = 300

export async function outputChannel(message: Message, kind: OutputKind): Promise<SendableChannels | null> {
  const guild = message.guild
  const me = guild?.members.me
  if (!guild || !me) return null
  const id = await getGuildOutputChannel(guild.id, kind).catch(() => null)
  if (!id || id === message.channelId) return null
  const channel = guild.channels.cache.get(id)
  if (!channel?.isSendable() || !("permissionsFor" in channel)) return null
  const allowed = channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
  return allowed ? channel : null
}

export async function sendTo(message: Message, kind: OutputKind, item: Note, intro = ""): Promise<void> {
  const target = item.tone === "warn" ? null : await outputChannel(message, kind)
  const said = intro.trim().slice(0, INTRO_MAX)
  if (!target) {
    if (said && item.tone !== "warn") {
      await message.reply({ content: said, allowedMentions: { parse: [], repliedUser: false } })
      if (message.channel.isSendable()) await message.channel.send(deliver(message.client, item))
      return
    }
    await reply(message, item)
    return
  }
  await target.send(deliver(message.client, item))
  await message.reply({
    content: said ? `${said}\n-# <#${target.id}>` : `-# Posted in <#${target.id}>`,
    allowedMentions: { parse: [], repliedUser: false },
  })
}
