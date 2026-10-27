# Iris

Discord bot for many servers, plus a web dashboard. Commands are prefix-only. The default prefix is `!iris`. Iris does not register slash commands.

A server manager can change that server's prefix, YouTube live alerts, and which commands are on. `help` and `prefix` stay available.

## Requirements

- Node.js 24.17 or newer
- pnpm 10.33.3
- Docker, for Postgres and Redis
- yt-dlp and ffmpeg on the machine that runs the player

In the Discord Developer Portal, turn on the Message Content intent. Register this OAuth redirect:

```text
${WEB_ORIGIN}/api/auth/callback
```

Run one Gateway process. Two processes with the same `DISCORD_TOKEN` disconnect each other.

## Run

```bash
cp .env.example .env
docker compose up postgres redis -d
pnpm install
pnpm dev
```

Fill in `.env` before starting. `pnpm dev` starts the bot, the site, and the player.

- Site: http://localhost:3000
- Bot health: http://127.0.0.1:8081/health
- Player health: http://127.0.0.1:8090/health

After `.env` changes, start the process again. `tsx watch` does not reload it.

## Commands

Examples use the default prefix. A server with a custom prefix uses that prefix instead.

| Command | What it does |
| --- | --- |
| `!iris help` | Shows the commands that are on for this server |
| `!iris about` | Who made Iris, and why |
| `!iris ping` | Checks that Iris is online |
| `!iris prefix` | Shows this server's prefix |
| `!iris join` | Joins your voice channel |
| `!iris play [new] <title or links...>` | Plays a YouTube title, links, or a playlist. `new` replaces the queue |
| `!iris pause` | Pauses |
| `!iris resume` | Continues |
| `!iris next` | Plays the next song |
| `!iris skip` | Same as next |
| `!iris stop` | Stops playback and clears the queue |
| `!iris queue [page\|next]` | Shows the queue, eight songs per page |
| `!iris loop [one\|all\|off]` | Repeats the current song, or the whole queue |
| `!iris leave` | Leaves the voice channel |
| `!iris live` | Opens the alert-channel menu |
| `!iris live <link or @handle>` | Adds a YouTube channel for this server |
| `!iris live list` | Shows this server's channels |
| `!iris live remove <channel>` | Removes one channel from this server |

The person who starts music must already be in a normal voice channel. Iris needs Connect and Speak there. If nobody else stays in that channel for one minute, Iris leaves. Other bots are not counted.

`!iris live` does not use voice. The watch list and the destination channel belong to one Discord server. A server can watch up to 50 YouTube channels. Who may change the list: the server owner, Manage Server, or Administrator.

## Deploy

Dokploy uses `docker-compose.yml` with Isolated Deployments. Attach the domain to the `web` service on port 3000. The services that start are `postgres`, `redis`, `bot`, and `web`.

The bot has no public port. Keep it at one replica. Set `PLAYER_URL` and `PLAYER_TOKEN` in the bot environment.

## Checks

```bash
pnpm typecheck
pnpm test
```
