import { boolean, pgTable, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core"

export const guilds = pgTable("guilds", {
  id: text("id").primaryKey(),
  name: text("name"),
  prefix: text("prefix"),
  liveChannelId: text("live_channel_id"),
  musicChannelId: text("music_channel_id"),
  lyricsChannelId: text("lyrics_channel_id"),
  disabledCommands: text("disabled_commands").array().notNull().default([]),
  volume: smallint("volume").notNull().default(10),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  welcomeMessage: text("welcome_message"),
  boostChannelId: text("boost_channel_id"),
  boostEnabled: boolean("boost_enabled").notNull().default(false),
  boostMessage: text("boost_message"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type GuildRecord = typeof guilds.$inferSelect

export const liveWatches = pgTable(
  "live_watches",
  {
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    discordChannelId: text("discord_channel_id").notNull(),
    youtubeChannelId: text("youtube_channel_id").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    liveVideoId: text("live_video_id"),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.youtubeChannelId] })],
)

export type LiveWatch = typeof liveWatches.$inferSelect

export const guildAi = pgTable("guild_ai", {
  guildId: text("guild_id")
    .primaryKey()
    .references(() => guilds.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  keySealed: text("key_sealed").notNull(),
  keyHint: text("key_hint").notNull(),
  reasoning: boolean("reasoning").notNull().default(false),
  persona: text("persona").notNull().default(""),
  temperatureTenths: smallint("temperature_tenths"),
  chatChannelIds: text("chat_channel_ids").array().notNull().default([]),
  channelContext: boolean("channel_context").notNull().default(false),
  timeZone: text("time_zone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
