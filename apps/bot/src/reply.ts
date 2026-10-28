import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  MessageFlags,
  SelectMenuDefaultValueType,
  SeparatorSpacingSize,
  type ActionRowData,
  type ChannelSelectMenuComponentData,
  type ComponentInContainerData,
  type ContainerComponentData,
  type InteractionButtonComponentData,
  type Client,
  type Message,
  type MessageCreateOptions,
} from "discord.js"

const copper = 0xd7a15f
const rose = 0xe0a096

export type Line = {
  name: string
  value: string
}

export type PlaybackControls = {
  paused: boolean
  page: number
  pages: number
  loop: "off" | "one" | "all"
  volume: number
}

export type ChannelPick = {
  customId: string
  placeholder: string
  channelId?: string
}

export type Note = {
  kicker?: string
  title: string
  description?: string
  fields?: Line[]
  tone?: "warn"
  controls?: PlaybackControls
  channelPick?: ChannelPick
}

export function safe(value: string): string {
  return value.replace(/[\\*_`~|]/g, "\\$&").replace(/\s+/g, " ").trim().slice(0, 180)
}

export function note(title: string, description?: string, fields?: Line[]): Note {
  return { title, description, fields }
}

export function scene(kicker: string, title: string, description?: string): Note {
  return { kicker, title, description }
}

export function warn(title: string, description: string): Note {
  return { title, description, tone: "warn" }
}

function body(item: Note): string {
  const lines = item.fields?.map((field) => `**${field.name}**\n-# ${field.value}`) ?? []
  return [item.description, lines.join("\n\n")].filter(Boolean).join("\n\n").slice(0, 3900)
}

function button(
  customId: string,
  emoji: string,
  label: string,
  style: Exclude<ButtonStyle, ButtonStyle.Link>,
  disabled = false,
): InteractionButtonComponentData {
  return {
    type: ComponentType.Button,
    style,
    customId,
    label,
    disabled,
    ...(emoji ? { emoji } : {}),
  }
}

function controlRows(controls: PlaybackControls): ComponentInContainerData[] {
  const rows: ComponentInContainerData[] = [
    {
      type: ComponentType.ActionRow,
      components: [
        button("iris:pause", "⏸️", "Pause", ButtonStyle.Secondary, controls.paused),
        button("iris:resume", "▶️", "Resume", ButtonStyle.Success, !controls.paused),
        button("iris:next", "⏭️", "Next", ButtonStyle.Primary),
        button("iris:stop", "⏹️", "Stop", ButtonStyle.Danger),
      ],
    },
    {
      type: ComponentType.ActionRow,
      components: [
        button("iris:volume:down", "🔉", "Down", ButtonStyle.Secondary, controls.volume <= 0),
        button("iris:volume:level", "", `${controls.volume}%`, ButtonStyle.Secondary, true),
        button("iris:volume:up", "🔊", "Up", ButtonStyle.Secondary, controls.volume >= 200),
      ],
    },
    {
      type: ComponentType.ActionRow,
      components: [
        button("iris:page:" + (controls.page - 1), "◀️", "Previous", ButtonStyle.Secondary, controls.page <= 1),
        button("iris:page:" + (controls.page + 1), "▶️", "Next page", ButtonStyle.Secondary, controls.page >= controls.pages),
      ],
    },
    {
      type: ComponentType.ActionRow,
      components: [
        button("iris:loop:one", "🔂", "Loop one", controls.loop === "one" ? ButtonStyle.Success : ButtonStyle.Secondary),
        button("iris:loop:all", "🔁", "Loop all", controls.loop === "all" ? ButtonStyle.Success : ButtonStyle.Secondary),
      ],
    },
  ]
  return rows
}

function card(client: Client, item: Note): ComponentInContainerData[] {
  const mark = item.kicker ? `-# Iris  ·  ${item.kicker}` : "-# Iris"
  const heading = item.tone === "warn" ? `## ⚠️ ${item.title}` : `## ${item.title}`
  const avatar = client.user?.displayAvatarURL({ extension: "png", size: 128 })
  const blocks: ComponentInContainerData[] = [
    avatar
      ? {
          type: ComponentType.Section,
          components: [
            { type: ComponentType.TextDisplay, content: mark },
            { type: ComponentType.TextDisplay, content: heading },
          ],
          accessory: {
            type: ComponentType.Thumbnail,
            media: { url: avatar },
            description: "Iris",
          },
        }
      : { type: ComponentType.TextDisplay, content: `${mark}\n${heading}` },
  ]
  const text = body(item)
  if (text) {
    blocks.push(
      { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacingSize.Small },
      { type: ComponentType.TextDisplay, content: text },
    )
  }
  if (item.controls) blocks.push(...controlRows(item.controls))
  if (item.channelPick) blocks.push(channelMenu(item.channelPick))
  return blocks
}

function channelMenu(pick: ChannelPick): ActionRowData<ChannelSelectMenuComponentData> {
  const menu: ChannelSelectMenuComponentData = {
    type: ComponentType.ChannelSelect,
    customId: pick.customId,
    placeholder: pick.placeholder,
    minValues: 1,
    maxValues: 1,
    channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
    defaultValues: pick.channelId
      ? [{ id: pick.channelId, type: SelectMenuDefaultValueType.Channel }]
      : undefined,
  }
  return { type: ComponentType.ActionRow, components: [menu] }
}

function container(client: Client, item: Note): ContainerComponentData {
  return {
    type: ComponentType.Container,
    accentColor: item.tone === "warn" ? rose : copper,
    components: card(client, item),
  }
}

export async function reply(message: Message, item: Note): Promise<Message> {
  return message.reply({
    flags: MessageFlags.IsComponentsV2,
    components: [container(message.client, item)],
    allowedMentions: { parse: [], repliedUser: false },
  })
}

export async function editReply(message: Message, item: Note): Promise<Message> {
  return message.edit({
    flags: MessageFlags.IsComponentsV2,
    components: [container(message.client, item)],
    allowedMentions: { parse: [], repliedUser: false },
  })
}

export function present(message: Message, item: Note): MessageCreateOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container(message.client, item)],
    allowedMentions: { parse: [], repliedUser: false },
  }
}

export function deliver(client: Client, item: Note): MessageCreateOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container(client, item)],
    allowedMentions: { parse: [], repliedUser: false },
  }
}
