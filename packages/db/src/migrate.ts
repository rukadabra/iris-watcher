import { getSql } from "./client"

const MIGRATION = `
CREATE TABLE IF NOT EXISTS guilds (
  id text PRIMARY KEY,
  name text,
  prefix text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guilds_prefix_check CHECK (
    prefix IS NULL
    OR (
      char_length(prefix) BETWEEN 1 AND 12
      AND prefix !~ '\\s'
      AND prefix !~ '[@<>]'
    )
  )
);

CREATE TABLE IF NOT EXISTS live_watches (
  guild_id text NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_channel_id text NOT NULL,
  youtube_channel_id text NOT NULL,
  name text NOT NULL,
  live_video_id text,
  PRIMARY KEY (guild_id, youtube_channel_id),
  CONSTRAINT live_watches_channel_check CHECK (discord_channel_id ~ '^[0-9]{5,22}$'),
  CONSTRAINT live_watches_youtube_check CHECK (youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  CONSTRAINT live_watches_video_check CHECK (
    live_video_id IS NULL OR live_video_id ~ '^[A-Za-z0-9_-]{11}$'
  ),
  CONSTRAINT live_watches_name_check CHECK (char_length(name) BETWEEN 1 AND 100)
);

ALTER TABLE guilds ADD COLUMN IF NOT EXISTS live_channel_id text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS disabled_commands text[] NOT NULL DEFAULT '{}';
ALTER TABLE live_watches ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
`

export async function migrate(): Promise<void> {
  await getSql().unsafe(MIGRATION)
}
