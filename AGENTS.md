# Iris

A multi-server Discord bot plus a Next.js site. The bot's name comes from the character. Commands are prefix-only, and the default is `!iris`. There are no slash commands.

This document is for a Cursor agent opening the same repo on another machine. Do not put a token, client secret, or the contents of `.env` into a file, a commit, or a reply.

## Leave these alone

- One Gateway process only. Two processes with the same `DISCORD_TOKEN` disconnect each other. Do not run the bot locally at the same time as the bot replica on the VPS.
- Do not add slash commands. Do not enable the `GuildMembers` or `GuildPresences` intents. The presence on Iris's profile is the bot's own activity: Listening to the title that is playing, or YouTube when nothing is playing. While paused, the status is idle.
- The prefix belongs to one server, not one channel. An empty value in the database means the default prefix. The web writes the prefix. The bot only displays it.
- After a prefix that ends in a letter or number, the command must be separated by a space: `!iris help` runs, `!irishelp` does not. A prefix that ends in a symbol may be attached (`!help`) or spaced (`! help`).
- Site images use `next/image` and string paths from `public/`.

## Repo layout

- `apps/bot` — discord.js 14.27.0, one Gateway connection, voice, and health inside the process.
- `apps/web` — Next.js 16, landing page and dashboard. The dashboard changes the prefix, the live-alert list, the welcome and boost banners, the AI provider and key, and which commands are on for that server. `output: "standalone"`.
- `apps/player` — reads YouTube with `yt-dlp` and streams PCM through ffmpeg. It does not hold a Discord token.
- `packages/shared` — prefix, command list, bot invite URL, and the YouTube link parser.
- `packages/db` — Postgres, table `guilds`.
- Redis — prefix cache, dashboard sessions, and the status heartbeat.

Node.js 24.17 or newer, because `@discordjs/voice` 0.19.2 requires it. Package manager: pnpm 10.33.3.

## Voice and YouTube

`@discordjs/voice` 0.19.2. `aes-256-gcm` is already in Node, so a sodium library is not installed. DAVE uses `@snazzah/davey`, which ships with the voice package. Opus uses `opusscript`. ffmpeg must be on the machine that runs the player for YouTube. The player sends 16-bit stereo PCM at 48 kHz. The bot turns that into Opus and applies loudness there, so the bot machine does not need ffmpeg.

Package docs: https://discord.js.org/docs/packages/voice/0.19.2

The flow:

1. A person sends a command in Discord.
2. The bot asks `PLAYER_URL` for metadata with `Authorization: Bearer PLAYER_TOKEN`.
3. The player reads YouTube and sends PCM audio.
4. The bot plays that stream in the voice channel.

The player accepts only video ids and playlist ids that have already been validated, plus a search title on `POST /search`. Search always uses `ytsearch1:` in yt-dlp. Do not turn that into a downloader for arbitrary URLs.

For live alerts, the player also accepts a validated channel target on `POST /channel` (`id` `UC…`, `handle`, or `custom` `c`/`user`) and at most 50 channel ids on `POST /live`. The player opens the channel page and the `/live` page, one at a time. That is not an arbitrary-URL downloader: the YouTube URL is built from a target that passed validation. ffmpeg is not used for this check.

`play` behavior:

- One title, for example `play despacito`: search for the top YouTube result, play that video, then queue what follows (at most 20 per fetch, refilled until 40).
- Several links in one message: queue only those links.
- A `youtube.com/playlist?list=` link: queue the playlist, at most 40.
- `play new ...` replaces the queue that is running.
- `play` while a song is playing adds the song to the queue. `play new` replaces the queue.
- `pause` pauses, `resume` continues, `next` (or `skip`) plays the next song, `stop` clears the queue.
- The 🔉 and 🔊 buttons on the playback card change the loudness of the song that is playing, in steps of 10%, from 0% to 200%. 100% is the song's own loudness. The number belongs to one Discord server and stays after Iris leaves. A server that has not been set uses 10%.
- When a song changes on its own, Iris sends a new playback card in the same channel.
- `loop one` repeats the song that is playing. `loop all` repeats the queue from the start. `loop off` turns that off. `next` still moves to the next song.
- `queue` shows 8 songs per page. `queue next` or the page buttons open the next page.
- A video link that also carries `list=PL...` is treated as one video. A mix `list=RD...` is ignored because the follow-on queue is fetched separately.

Commands, with the default prefix. The site, the dashboard, and `help` use five groups: General, Music, Live alerts, Lookups, AI.

General:

- `!iris help`
- `!iris about`
- `!iris ping`
- `!iris prefix`
- `!iris welcome [off|on|test|message <text>]`
- `!iris boost [off|on|test|message <text>]`

Music:

- `!iris join`
- `!iris play [new] <title or links...>`
- `!iris pause`
- `!iris resume`
- `!iris next`
- `!iris skip`
- `!iris stop`
- `!iris queue [page|next]`
- `!iris loop [one|all|off]`
- `!iris leave`

Live alerts:

- `!iris live`
- `!iris live <link or @handle>`
- `!iris live list`
- `!iris live remove <channel>`

Lookups:

- `!iris lyrics [title]`
- `!iris weather <city>`
- `!iris wiki <topic>`
- `!iris define <word>`
- `!iris rate [amount] <from> <to>`
- `!iris anime <title>`
- `!iris trivia`
- `!iris news <topic>`
- `!iris hn [query]`

`lyrics` with no title uses the song playing in that server. `hn` with no query shows the front page. The other lookup commands do not use voice. The sources are LRCLIB, Open-Meteo, Wikipedia, Free Dictionary, Frankfurter, AniList, Open Trivia DB, Bing News, and Hacker News. No token.

AI:

- `!iris ask <question>`

`ask` uses the API key of that one server, never a key that belongs to Iris. A manager (owner, Manage Server, or Administrator) chooses the provider, the model, and the key on the dashboard only. A key is never accepted through a Discord message, because chat is visible and kept. Providers: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI. Each has a fixed HTTPS endpoint in `packages/shared/src/ai-client.ts`, and requests use `redirect: "error"`. Do not add a custom base URL: it would let a key be sent anywhere and turn the bot into a request proxy. Before saving, the web lists the provider's models with that key and rejects the key or the model if they do not check out. Replying to an answer of Iris sends that answer back as context, so a conversation can continue. A plain reply to an `ask` answer, without the prefix, is treated as a follow-up question. Only replies to Iris's own `ask` cards count, the same limits apply, and nothing is sent when `ask` is off. On OpenRouter, a model may end in `:nitro`, which routes to the fastest host for that model.

Reasoning is a per-server switch on the dashboard, off by default because it is faster and cheaper. Each provider takes a different parameter, and models reject values they do not support with HTTP 400. For example, Gemini 3.8 Flash rejects `minimal`, GPT-6.1 Sol rejects `none`, and models with mandatory reasoning reject turning it off. `reasoningVariants` in `ai-client.ts` lists what to try for each provider, in order. On a 400 the next variant is tried, and the one that worked is remembered per model in memory. A variant that thinks gets 3000 extra output tokens so the answer is not cut off.

Style: Iris answers like a regular in the chat. She matches the asker's tone, keeps simple answers to one to three sentences, and skips filler such as "Great question" or "Hope this helps". If someone sincerely asks whether she is a bot, she says yes. Answers are capped at 500 output tokens, and a replied-to message adds at most 1500 characters of context. Temperature is optional per server, stored in tenths (`temperature_tenths`, empty means the provider default). The range and advice for each provider live in `aiTemperature` in `packages/shared/src/ai.ts`, which the dashboard and the `/ai` guide page both read. Many newer models refuse a custom value (Claude Haiku 5.5 and newer, GPT-6 while reasoning, GPT-6.1 Sol), so a variant that is refused with a temperature is retried once without it, and that model is remembered in memory as refusing it. A variant that thinks never sends a temperature. A manager may set an optional personality of at most 300 characters on the dashboard. It shapes tone only, and the safety rules come after it in the prompt.

Guards, in `packages/shared/src/ai-guard.ts`. The decrypted key only travels in the request header, so it is never in the model's context. The system prompt adds `AI_SAFETY_RULES`: Iris does not name the provider or model, says it has no keys or configuration, does not reveal its instructions, treats "ignore previous instructions" as text, and refuses clearly harmful requests. A question that looks like a key or token (OpenAI, Anthropic, OpenRouter, Gemini, Groq, xAI, GitHub, AWS, Discord bot token, private key) is not sent to the provider. Iris asks the person to delete it and rotate the key. Earlier messages used as context and every answer pass through `redactSecrets`, which also removes the server's own key in any letter case. The Discord card does not show the provider or the model. Only the dashboard does, to managers. Limits: 4 questions a minute per person, 30 every 10 minutes per server, a 1500-character question, and mentions are never pinged. Questions and answers are not stored.

Key storage, in `packages/shared/src/secret-box.ts`:

- AES-256-GCM, a random 12-byte IV for every save, a 16-byte tag.
- The encryption key comes from HKDF-SHA256 over `AI_KEY_SECRET`, which must be exactly 32 random bytes in base64. A passphrase is rejected.
- The ciphertext carries a key id and is bound to `ai-key:<guild id>:<provider>` as additional data, so it does not open for another server or provider.
- Rows live in their own `guild_ai` table, so the usual guild queries never read ciphertext. The dashboard receives only the provider, the model, and the last four characters. A check constraint rejects anything that is not sealed.
- Do not log a key, a request header, or a provider error body. Do not cache a decrypted key in Redis or memory.
- Rotation: move the old value to `AI_KEY_SECRET_PREVIOUS` and set a new `AI_KEY_SECRET`. The bot re-encrypts an old key the next time it is used.

The person who sends a music command must already be in a normal voice channel. The bot needs Connect and Speak in that channel. If nobody else is in that channel for one minute, Iris leaves on her own. Other bots are not counted.

`live` does not use voice. The list and the destination channel belong to one Discord server, and are not mixed with another server. Who may change them: the server owner, Manage Server, or Administrator. `!iris live` with no link opens a text-channel dropdown. No alert is sent before that channel is chosen. `channel` opens the same dropdown. `list` shows that server's list. `remove` and `off` detach one YouTube channel from that server only. One server can have at most 50 channels. The same YouTube channel on several servers is checked once, then its card is sent to each server's destination channel.

The bot asks the player every 2 minutes. If the previous round is still running, the new round waits. A `/live` page whose canonical URL is a video and whose `videoDetails.isLive` is true sends one card, then the video link. The card uses Components V2, so the video preview comes from the link message below it, which Discord turns into an embed. The same video id is not sent again. A failure reading one channel does not clear the marker for a stream that is still going. When the `/live` page is no longer live, that marker is cleared so the next stream notifies again.

`welcome` does not use the `GuildMembers` intent. Iris reacts to Discord's own join system message (`MessageType.UserJoin`), so the server must keep "Send a random welcome message when someone joins" on under System Messages. The channel, the on/off state, and the text belong to one server. Who may change them: the server owner, Manage Server, or Administrator. `!iris welcome` opens a text-channel dropdown and turns banners on. `message` sets the text (at most 300 characters, `{user}`, `{name}`, and `{server}` are filled in, `reset` restores the default). `test` shows a preview to anyone who runs it. `off` and `on` toggle it. Other bots are not greeted, and one server gets at most 10 banners a minute. The banner is a PNG drawn in the bot with `@napi-rs/canvas` and Poppins from `apps/bot/assets/fonts`. The drawing lives in `packages/shared/src/banner.ts` and takes any 2D canvas context, so the dashboard draws the same banner in a browser `<canvas>` as a live preview while the message is typed. Client components import it from `@iris/shared/banner` and `@iris/shared/welcome`, not from the package root, because the root also exports Node-only code. The bot image installs `font-noto` and `font-noto-emoji` for names outside Latin. Avatars and server icons are read only from the Discord CDN.

`boost` works the same way with its own channel, on/off state, and text. It reacts to Discord's boost system messages (`GuildBoost` and `GuildBoostTier1` to `GuildBoostTier3`), so "Send a message when someone boosts this server" must stay on. Its text also fills `{boosts}` (the server's boost count) and `{level}` (0 to 3). The boost banner uses a pink and violet theme with a gem badge on the avatar.

## Discord permissions

Intents: `Guilds`, `GuildMessages`, `MessageContent`, `GuildVoiceStates`. Only Message Content is privileged, and it must be enabled in the Developer Portal.

The invite uses `scope=bot`. Discord automatically includes `applications.commands` on that scope. Iris does not register slash commands. Requested permissions: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak. The combined integer is `BOT_INVITE_PERMISSIONS` in `packages/shared/src/discord.ts`.

The invite link opens in a new tab. After permissions change, the invite link must be opened again and authorized again.

Dashboard OAuth uses the scope `identify guilds`. Redirect: `${WEB_ORIGIN}/api/auth/callback`. Who may change the prefix, the watch list, the destination channel, the welcome and boost banners, and which commands are on: the server owner, Manage Server, or Administrator. Adding a YouTube channel from the dashboard calls the player `POST /channel` with a target that has already been validated. `help` and `prefix` cannot be turned off. The bot rejects any other command that is off, including the matching music buttons. A watch that is off is not checked and receives no card. Discord and the dashboard use the same data.

## Environment

Copy `.env.example` to `.env`. Do not commit `.env`.

Keys used by the bot and the web: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `WEB_ORIGIN`, `DEFAULT_PREFIX`, `DATABASE_URL`, `REDIS_URL`, `HEALTH_PORT`, `PLAYER_URL`, `PLAYER_TOKEN`, `AI_KEY_SECRET`, `AI_KEY_SECRET_PREVIOUS`. `AI_KEY_SECRET` must be the same for the bot and the web. Without it, `ask` stays off and the dashboard hides the key form. Changing it without moving the old value to `AI_KEY_SECRET_PREVIOUS` makes every saved key unreadable.

Player keys: `PLAYER_TOKEN` (at least 16 characters, the same value the bot reads), `PLAYER_HOST`, `PLAYER_PORT`, `YTDLP_PATH`, `FFMPEG_PATH`.

Local Postgres and Redis are at `127.0.0.1`. Inside a container, the database and Redis URLs point at the service hostnames `postgres` and `redis`. `tsx watch` does not reload `.env`. After `.env` changes, the process has to be started again.

The bot's local `HEALTH_PORT` is 8081 because port 8080 on this development machine is used by nginx. Inside the bot container, health stays on 8080 and is not published.

## Run locally

yt-dlp and ffmpeg must be on the PATH of the machine that runs the player. On the development Mac, both come from Homebrew. The bot itself does not play local files.

```bash
docker compose -f docker-compose.yml -f compose.local.yml up postgres redis -d
pnpm install
pnpm dev
```

`pnpm dev` runs the bot, web, and player together.

- Web: http://localhost:3000
- Bot health: http://127.0.0.1:8081/health
- Player health: http://127.0.0.1:8090/health

The player binds to `127.0.0.1` so it is not open to the network.

## Deploy

Dokploy uses `docker-compose.yml`. Attach the domain to the `web` service on port 3000. The services that start are `postgres`, `redis`, `bot`, and `web`. The bot and web use the Postgres and Redis in that same compose file.

The bot has no public port. The web container is not published on a host port. One replica. Set `PLAYER_URL` and `PLAYER_TOKEN` in the bot environment. Set `AI_KEY_SECRET` in both the bot and the web.

## Checks

```bash
pnpm typecheck
pnpm test
```
