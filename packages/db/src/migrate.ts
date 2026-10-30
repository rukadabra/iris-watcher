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
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS volume smallint NOT NULL DEFAULT 10;
ALTER TABLE live_watches ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS welcome_channel_id text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS welcome_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS boost_channel_id text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS boost_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS boost_message text;

DO $$ BEGIN
  ALTER TABLE guilds ADD CONSTRAINT guilds_volume_check CHECK (volume BETWEEN 0 AND 200 AND volume % 10 = 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE guilds ADD CONSTRAINT guilds_welcome_check CHECK (
    (welcome_channel_id IS NULL OR welcome_channel_id ~ '^[0-9]{5,22}$')
    AND (welcome_message IS NULL OR char_length(welcome_message) BETWEEN 1 AND 300)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS guild_ai (
  guild_id text PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  key_sealed text NOT NULL,
  key_hint text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guild_ai_provider_check CHECK (provider ~ '^[a-z]{2,20}$'),
  CONSTRAINT guild_ai_model_check CHECK (char_length(model) BETWEEN 1 AND 120),
  CONSTRAINT guild_ai_key_check CHECK (
    key_sealed ~ '^v1\\.[A-Za-z0-9_-]{8}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{22}$'
  ),
  CONSTRAINT guild_ai_hint_check CHECK (char_length(key_hint) BETWEEN 1 AND 4)
);

DO $$ BEGIN
  ALTER TABLE guilds ADD CONSTRAINT guilds_boost_check CHECK (
    (boost_channel_id IS NULL OR boost_channel_id ~ '^[0-9]{5,22}$')
    AND (boost_message IS NULL OR char_length(boost_message) BETWEEN 1 AND 300)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`

export async function migrate(): Promise<void> {
  await getSql().unsafe(MIGRATION)
}
