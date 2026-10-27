export const commandGroups = [
  { id: "general", label: "General" },
  { id: "music", label: "Music" },
  { id: "live", label: "Live alerts" },
] as const

export type CommandGroup = (typeof commandGroups)[number]["id"]

export const commandList = [
  {
    name: "help",
    group: "general",
    emoji: "📖",
    summary: "Shows the commands Iris can run",
    usage: "help",
  },
  {
    name: "about",
    group: "general",
    emoji: "🌿",
    summary: "Who made Iris, where to find them, and why she exists",
    usage: "about",
  },
  {
    name: "ping",
    group: "general",
    emoji: "🏓",
    summary: "Checks whether Iris is online",
    usage: "ping",
  },
  {
    name: "prefix",
    group: "general",
    emoji: "✏️",
    summary: "Shows this server's prefix",
    usage: "prefix",
  },
  {
    name: "join",
    group: "music",
    emoji: "🎧",
    summary: "Joins the voice channel you are in",
    usage: "join",
  },
  {
    name: "play",
    group: "music",
    emoji: "🎵",
    summary:
      "Searches YouTube by title, or plays links. One result continues on its own. Several links, or a playlist link, become the queue. new replaces the queue",
    usage: "play [new] <title or links...>",
  },
  {
    name: "pause",
    group: "music",
    emoji: "⏸️",
    summary: "Pauses the current song",
    usage: "pause",
  },
  {
    name: "resume",
    group: "music",
    emoji: "▶️",
    summary: "Continues a paused song",
    usage: "resume",
  },
  {
    name: "next",
    group: "music",
    emoji: "⏭️",
    summary: "Skips the current song and plays the next one",
    usage: "next",
  },
  {
    name: "skip",
    group: "music",
    emoji: "⏭️",
    summary: "Same as next",
    usage: "skip",
  },
  {
    name: "stop",
    group: "music",
    emoji: "⏹️",
    summary: "Stops playback and clears the queue",
    usage: "stop",
  },
  {
    name: "queue",
    group: "music",
    emoji: "🎶",
    summary: "Shows the queue. next opens the following page",
    usage: "queue [page|next]",
  },
  {
    name: "loop",
    group: "music",
    emoji: "🔁",
    summary: "Repeats the current song, or the whole queue. off turns it off",
    usage: "loop [one|all|off]",
  },
  {
    name: "leave",
    group: "music",
    emoji: "👋",
    summary: "Leaves the voice channel",
    usage: "leave",
  },
  {
    name: "live",
    group: "live",
    emoji: "🔴",
    summary:
      "Choose this server's alert channel from the menu, then add a YouTube channel. list shows them, remove turns one off",
    usage: "live [list|remove] <link or @handle>",
  },
] as const satisfies ReadonlyArray<{
  name: string
  group: CommandGroup
  emoji: string
  summary: string
  usage: string
}>

export type CommandName = (typeof commandList)[number]["name"]

const alwaysOn = new Set<CommandName>(["help", "prefix"])

export function isToggleableCommand(name: string): name is CommandName {
  return commandList.some((command) => command.name === name) && !alwaysOn.has(name as CommandName)
}

export function sanitizeDisabledCommands(names: readonly string[]): CommandName[] {
  const unique = new Set<CommandName>()
  for (const name of names) {
    if (isToggleableCommand(name)) unique.add(name)
  }
  return [...unique]
}
