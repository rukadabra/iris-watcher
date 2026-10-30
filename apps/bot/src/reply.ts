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
  image?: string
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

export type NoteLink = {
  label: string
  url: string
}

export type Note = {
  kicker?: string
  title: string
  description?: string
  fields?: Line[]
  footer?: string
  image?: string
  thumbnail?: string
  accent?: number
  links?: NoteLink[]
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
  const custom = item.thumbnail && /^https?:\/\//i.test(item.thumbnail) ? item.thumbnail.slice(0, 2048) : ""
  const avatar = custom || client.user?.displayAvatarURL({ extension: "png", size: 128 })
  const inline = !item.title && item.description && !item.image && !item.fields?.length ? item.description.slice(0, 3900) : ""
  const top = [mark, ...(item.title ? [heading] : []), ...(inline ? [inline] : [])]
  const blocks: ComponentInContainerData[] = [
    avatar
      ? {
          type: ComponentType.Section,
          components: top.map((content) => ({ type: ComponentType.TextDisplay, content })),
          accessory: {
            type: ComponentType.Thumbnail,
            media: { url: avatar },
            description: custom ? (item.title || "Iris").slice(0, 1024) : "Iris",
          },
        }
      : { type: ComponentType.TextDisplay, content: top.join("\n") },
  ]
  if (item.image && /^https?:\/\//i.test(item.image)) {
    blocks.push(
      { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacingSize.Small },
      {
        type: ComponentType.MediaGallery,
        items: [{ media: { url: item.image.slice(0, 2048) }, description: (item.title || "Iris").slice(0, 1024) }],
      },
    )
  }
  const pictured = item.fields?.some((field) => field.image && /^https?:\/\//i.test(field.image))
  if (pictured && item.fields?.length) {
    blocks.push({ type: ComponentType.Separator, divider: true, spacing: SeparatorSpacingSize.Small })
    if (item.description) {
      blocks.push({ type: ComponentType.TextDisplay, content: item.description.slice(0, 3900) })
    }
    for (const field of item.fields) {
      blocks.push(fieldBlock(field))
    }
  } else if (!inline) {
    const text = body(item)
    if (text) {
      blocks.push(
        { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacingSize.Small },
        { type: ComponentType.TextDisplay, content: text },
      )
    }
  }
  if (item.footer) {
    blocks.push({ type: ComponentType.TextDisplay, content: `-# ${item.footer}` })
  }
  if (item.links?.length) blocks.push(...linkRows(item.links))
  if (item.controls) blocks.push(...controlRows(item.controls))
  if (item.channelPick) blocks.push(channelMenu(item.channelPick))
  return blocks
}

function fieldBlock(field: Line): ComponentInContainerData {
  const [first, ...rest] = field.value.split("\n")
  const lines = [
    `**${field.name}**`,
    first ? `-# ${first}` : "",
    ...rest,
  ].filter(Boolean)
  const content = lines.join("\n").slice(0, 3900)
  const image = field.image?.trim() ?? ""
  if (/^https?:\/\//i.test(image)) {
    return {
      type: ComponentType.Section,
      components: [{ type: ComponentType.TextDisplay, content }],
      accessory: {
        type: ComponentType.Thumbnail,
        media: { url: image.slice(0, 2048) },
        description: field.name.slice(0, 1024),
      },
    }
  }
  return { type: ComponentType.TextDisplay, content }
}

function linkRows(links: NoteLink[]): ComponentInContainerData[] {
  const rows: ComponentInContainerData[] = []
  for (let index = 0; index < links.length; index += 5) {
    const slice = links.slice(index, index + 5).filter((link) => /^https?:\/\//i.test(link.url) && link.url.length <= 512)
    if (slice.length === 0) continue
    rows.push({
      type: ComponentType.ActionRow,
      components: slice.map((link) => ({
        type: ComponentType.Button,
        style: ButtonStyle.Link,
        label: (link.label.trim() || "Open").slice(0, 80),
        url: link.url,
      })),
    })
  }
  return rows
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
    accentColor: item.tone === "warn" ? rose : (item.accent ?? copper),
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
