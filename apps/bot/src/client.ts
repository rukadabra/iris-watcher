import { ActivityType, Client, GatewayIntentBits } from "discord.js"

// Portal: Bot → Privileged Gateway Intents → Message Content Intent.
// Guilds + GuildMessages receive messageCreate. MessageContent fills the content field
// so the prefix can be read. GuildVoiceStates is not a privileged intent; Discord sends
// voice status so Iris knows which channel to join.
// https://docs.discord.com/developers/events/gateway#list-of-intents
// https://discord.js.org/docs/packages/discord.js/main/GatewayIntentBits:Enum
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  allowedMentions: { parse: ["users"], repliedUser: false },
  presence: {
    status: "online",
    activities: [{ name: "YouTube", type: ActivityType.Listening }],
  },
})
