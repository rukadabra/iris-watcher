export const commandGroups = [
  { id: "general", label: "General" },
  { id: "music", label: "Music" },
  { id: "live", label: "Live alerts" },
  { id: "lookups", label: "Lookups" },
  { id: "ai", label: "AI" },
] as const

export type CommandGroup = (typeof commandGroups)[number]["id"]

export const commandList = [
  {
    name: "help",
    group: "general",
    emoji: "📖",
    summary: "Shows the commands Iris can run",
    usage: "help",
    examples: [],
  },
  {
    name: "about",
    group: "general",
    emoji: "🌿",
    summary: "Who made Iris, where to find them, and why she exists",
    usage: "about",
    examples: [],
  },
  {
    name: "ping",
    group: "general",
    emoji: "🏓",
    summary: "Checks whether Iris is online",
    usage: "ping",
    examples: [],
  },
  {
    name: "prefix",
    group: "general",
    emoji: "✏️",
    summary: "Shows this server's prefix",
    usage: "prefix",
    examples: [],
  },
  {
    name: "welcome",
    group: "general",
    emoji: "👋",
    summary:
      "Greets new members with a banner. Choose the channel from the menu. message changes the text, test shows a preview, off turns it off",
    usage: "welcome [off|test|message <text>]",
    examples: ["welcome", "welcome message Hi {user}, welcome to {server}!", "welcome test"],
  },
  {
    name: "boost",
    group: "general",
    emoji: "💎",
    summary:
      "Thanks members who boost the server with a banner. Choose the channel from the menu. message changes the text, test shows a preview, off turns it off",
    usage: "boost [off|test|message <text>]",
    examples: ["boost", "boost message Thank you {user}! We now have {boosts} boosts.", "boost test"],
  },
  {
    name: "join",
    group: "music",
    emoji: "🎧",
    summary: "Joins the voice channel you are in",
    usage: "join",
    examples: [],
  },
  {
    name: "play",
    group: "music",
    emoji: "🎵",
    summary:
      "Searches YouTube by title, or plays links. One result continues on its own. Several links, or a playlist link, become the queue. new replaces the queue",
    usage: "play [new] <title or links...>",
    examples: ["play despacito", "play new despacito"],
  },
  {
    name: "pause",
    group: "music",
    emoji: "⏸️",
    summary: "Pauses the current song",
    usage: "pause",
    examples: [],
  },
  {
    name: "resume",
    group: "music",
    emoji: "▶️",
    summary: "Continues a paused song",
    usage: "resume",
    examples: [],
  },
  {
    name: "next",
    group: "music",
    emoji: "⏭️",
    summary: "Skips the current song and plays the next one",
    usage: "next",
    examples: [],
  },
  {
    name: "skip",
    group: "music",
    emoji: "⏭️",
    summary: "Same as next",
    usage: "skip",
    examples: [],
  },
  {
    name: "stop",
    group: "music",
    emoji: "⏹️",
    summary: "Stops playback and clears the queue",
    usage: "stop",
    examples: [],
  },
  {
    name: "queue",
    group: "music",
    emoji: "🎶",
    summary: "Shows the queue. next opens the following page",
    usage: "queue [page|next]",
    examples: ["queue 2", "queue next"],
  },
  {
    name: "loop",
    group: "music",
    emoji: "🔁",
    summary: "Repeats the current song, or the whole queue. off turns it off",
    usage: "loop [one|all|off]",
    examples: ["loop one", "loop off"],
  },
  {
    name: "leave",
    group: "music",
    emoji: "👋",
    summary: "Leaves the voice channel",
    usage: "leave",
    examples: [],
  },
  {
    name: "live",
    group: "live",
    emoji: "🔴",
    summary:
      "Choose this server's alert channel from the menu, then add a YouTube channel. list shows them, remove turns one off",
    usage: "live [list|remove] <link or @handle>",
    examples: ["live @NASA", "live list", "live remove @NASA"],
  },
  {
    name: "lyrics",
    group: "lookups",
    emoji: "📝",
    summary: "Shows lyrics for the song that is playing, or for a title you name",
    usage: "lyrics [title]",
    examples: ["lyrics", "lyrics despacito"],
  },
  {
    name: "weather",
    group: "lookups",
    emoji: "🌤️",
    summary: "Shows the current weather for a city",
    usage: "weather <city>",
    examples: ["weather Denpasar"],
  },
  {
    name: "wiki",
    group: "lookups",
    emoji: "📚",
    summary: "Shows a short Wikipedia summary",
    usage: "wiki <topic>",
    examples: ["wiki Bali"],
  },
  {
    name: "define",
    group: "lookups",
    emoji: "📘",
    summary: "Shows an English definition",
    usage: "define <word>",
    examples: ["define iris"],
  },
  {
    name: "rate",
    group: "lookups",
    emoji: "💱",
    summary: "Converts a daily exchange rate, such as USD to IDR",
    usage: "rate [amount] <from> <to>",
    examples: ["rate USD IDR", "rate 10 USD IDR"],
  },
  {
    name: "anime",
    group: "lookups",
    emoji: "🎬",
    summary: "Shows an anime by title",
    usage: "anime <title>",
    examples: ["anime Spy x Family"],
  },
  {
    name: "trivia",
    group: "lookups",
    emoji: "❓",
    summary: "Asks one multiple-choice question. The answer is hidden",
    usage: "trivia",
    examples: [],
  },
  {
    name: "news",
    group: "lookups",
    emoji: "📰",
    summary: "Shows recent headlines for a topic",
    usage: "news <topic>",
    examples: ["news Bali"],
  },
  {
    name: "hn",
    group: "lookups",
    emoji: "🟧",
    summary: "Shows the Hacker News front page, or stories matching a search",
    usage: "hn [query]",
    examples: ["hn", "hn indonesia"],
  },
  {
    name: "ask",
    group: "ai",
    emoji: "✨",
    summary: "Asks the AI model this server chose on the dashboard. Reply to an answer to ask a follow-up",
    usage: "ask <question>",
    examples: ["ask why is the sky blue"],
  },
] as const satisfies ReadonlyArray<{
  name: string
  group: CommandGroup
  emoji: string
  summary: string
  usage: string
  examples: readonly string[]
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
