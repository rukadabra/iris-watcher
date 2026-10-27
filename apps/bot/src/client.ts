import { ActivityType, Client, GatewayIntentBits } from "discord.js"

// Portal: Bot → Privileged Gateway Intents → Message Content Intent.
// Guilds + GuildMessages menerima messageCreate. MessageContent mengisi field content
// supaya prefix terbaca. GuildVoiceStates bukan privileged intent; Discord mengirim
// status voice supaya Iris tahu channel yang harus dimasuki.
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
