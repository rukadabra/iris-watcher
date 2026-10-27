# Iris

Bot Discord multi-server plus situs Next.js. Nama bot diambil dari karakternya. Perintah hanya prefix, bawaan `!iris`. Tidak ada slash command.

Dokumen ini untuk agent Cursor yang membuka repo yang sama di mesin lain. Jangan menaruh token, client secret, atau isi `.env` ke dalam file, commit, atau balasan.

## Yang tidak boleh diubah

- Satu proses Gateway saja. Dua proses dengan `DISCORD_TOKEN` yang sama saling memutus sesi. Jangan menjalankan bot lokal bersamaan dengan replika bot di VPS.
- Jangan menambah slash command. Jangan menyalakan intent `GuildMembers` atau `GuildPresences`. Presence yang tampil di profil Iris adalah aktivitas bot sendiri: Listening to judul yang sedang diputar, atau YouTube saat tidak ada lagu. Saat jeda, statusnya idle.
- Prefix milik satu server, bukan satu channel. Nilai kosong di database berarti prefix bawaan. Penulis prefix adalah web. Bot hanya menampilkan prefix.
- Setelah prefix yang berakhir huruf atau angka, perintah wajib dipisah spasi: `!iris help` jalan, `!irishelp` tidak. Prefix yang berakhir simbol boleh menempel (`!help`) atau berjarak (`! help`).
- Gambar situs memakai `next/image` dan path string dari `public/`.

## Susunan repo

- `apps/bot` — discord.js 14.27.0, satu koneksi Gateway, voice, health di dalam proses.
- `apps/web` — Next.js 16, landing dan dashboard. Dashboard mengubah prefix, daftar pantauan siaran, dan perintah yang menyala di server itu. `output: "standalone"`.
- `apps/player` — membaca YouTube dengan `yt-dlp` dan mengalirkan audio Ogg Opus lewat ffmpeg. Tidak memegang token Discord.
- `packages/shared` — prefix, daftar perintah, URL undang bot, parser tautan YouTube.
- `packages/db` — Postgres, tabel `guilds`.
- Redis — cache prefix, sesi dashboard, heartbeat status.

Node.js minimal 24.17, karena `@discordjs/voice` 0.19.2 mensyaratkan itu. Package manager: pnpm 10.33.3.

## Voice dan YouTube

`@discordjs/voice` 0.19.2. Enkripsi `aes-256-gcm` sudah ada di Node, jadi library sodium tidak dipasang. DAVE memakai `@snazzah/davey` yang ikut bersama paket voice. Opus memakai `opusscript`. ffmpeg wajib ada di mesin player untuk YouTube. Bot menerima audio Ogg Opus, jadi mesin bot tidak membutuhkan ffmpeg.

Dokumen paket: https://discord.js.org/docs/packages/voice/0.19.2

Alurnya:

1. Pengguna mengirim perintah di Discord.
2. Bot meminta metadata ke `PLAYER_URL` dengan `Authorization: Bearer PLAYER_TOKEN`.
3. Player membaca YouTube lalu mengirim audio `audio/ogg`.
4. Bot memutar aliran itu di voice channel.

Player hanya menerima id video dan id playlist yang sudah divalidasi, plus judul pencarian pada `POST /search`. Pencarian selalu memakai `ytsearch1:` di yt-dlp. Jangan mengubahnya menjadi pengunduh URL bebas.

Untuk kabar siaran, player juga menerima target channel yang sudah divalidasi pada `POST /channel` (`id` `UC…`, `handle`, atau `custom` `c`/`user`) dan paling banyak 50 id channel pada `POST /live`. Player membuka halaman channel dan halaman `/live`, satu per satu. Itu bukan pengunduh URL bebas: URL YouTube disusun dari target yang lolos validasi. ffmpeg tidak dipakai untuk pemeriksaan ini.

Perilaku `play`:

- Satu judul, misalnya `play despacito`: cari hasil teratas di YouTube, putar video itu, lalu antre lanjutan (paling banyak 20 sekali ambil, isi ulang sampai 40).
- Beberapa tautan dalam satu pesan: antre tautan itu saja.
- Tautan `youtube.com/playlist?list=`: antre isi playlist, paling banyak 40.
- `play new ...` mengganti antrean yang sedang berjalan. `play baru` tetap dikenali.
- `play` saat lagu sedang berjalan menambahkan lagu ke antrean. `play new` mengganti antrean.
- `pause` pauses, `resume` continues, `next` (or `skip`) plays the next song, `stop` clears the queue.
- Saat lagu berganti sendiri, Iris mengirim kartu pemutaran baru di channel yang sama.
- `loop one` mengulang lagu yang sedang diputar. `loop all` mengulang antrean dari awal. `loop off` mematikannya. `satu`, `semua`, dan `mati` tetap dikenali. `next` tetap pindah lagu.
- `queue` menampilkan 8 lagu per halaman. `queue next` atau tombol halaman membuka halaman selanjutnya. `queue berikutnya` tetap dikenali.
- Tautan video yang juga membawa `list=PL...` diperlakukan sebagai satu video. Mix `list=RD...` diabaikan karena lanjutan diambil sendiri.

Perintah, dengan prefix bawaan. Daftar di situs, dashboard, dan `help` memakai tiga kelompok: General, Music, Live alerts.

General:

- `!iris help`
- `!iris about`
- `!iris ping`
- `!iris prefix`

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

Pengirim perintah musik harus sudah berada di voice channel biasa. Izin bot di channel itu: Connect dan Speak. Jika tidak ada orang lain di channel itu selama satu menit, Iris keluar sendiri. Bot lain tidak dihitung.

`live` tidak memakai voice. Daftar dan channel tujuan milik satu server Discord, tidak dicampur dengan server lain. Yang boleh mengubah: pemilik server, Manage Server, atau Administrator. `!iris live` tanpa tautan membuka dropdown channel teks. Kabar tidak dikirim sebelum channel itu dipilih. `channel` dan `saluran` membuka dropdown yang sama. `list` dan `daftar` menampilkan daftar server itu. `remove`, `hapus`, dan `off` melepas satu channel YouTube dari server itu saja. Satu server paling banyak 50 channel. Channel YouTube yang sama di beberapa server hanya diperiksa sekali, lalu kartunya dikirim ke channel tujuan masing-masing server.

Bot menanyakan player setiap 2 menit. Kalau putaran sebelumnya masih berjalan, putaran baru menunggu. Halaman `/live` yang kanoniknya video dan `videoDetails.isLive` true mengirim satu kartu, lalu tautan videonya. Kartu memakai Components V2, jadi preview video datang dari pesan tautan di bawahnya, yang Discord ubah menjadi embed. Id video yang sama tidak dikirim ulang. Kegagalan membaca satu channel tidak menghapus penanda siaran yang sedang berjalan. Saat halaman `/live` tidak lagi live, penanda itu dikosongkan supaya siaran berikutnya memberitahu lagi.

## Izin Discord

Intent: `Guilds`, `GuildMessages`, `MessageContent`, `GuildVoiceStates`. Hanya Message Content yang privileged, dan itu harus menyala di Developer Portal.

Undang bot memakai `scope=bot`. Discord otomatis menyertakan `applications.commands` pada scope itu. Iris tidak mendaftarkan slash command. Izin yang diminta: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak. Angka gabungannya ada di `BOT_INVITE_PERMISSIONS` pada `packages/shared/src/discord.ts`.

Tautan undang dibuka di tab baru. Setelah izin diubah, tautan undang harus dibuka ulang lalu di-authorize lagi.

Dashboard OAuth memakai scope `identify guilds`. Redirect: `${WEB_ORIGIN}/api/auth/callback`. Yang boleh mengubah prefix, daftar pantauan, channel tujuan, dan perintah yang menyala: pemilik server, Manage Server, atau Administrator. Menambah channel YouTube dari dashboard memanggil player `POST /channel` dengan target yang sudah divalidasi. `help` dan `prefix` tidak bisa dimatikan. Perintah lain yang dimatikan ditolak bot, termasuk tombol musik yang setara. Pantauan yang dimatikan tidak diperiksa dan tidak dikirimi kartu. Daftar Discord dan dashboard memakai data yang sama.

## Lingkungan

Salin `.env.example` menjadi `.env`. Jangan commit `.env`.

Kunci yang dipakai bot dan web: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `WEB_ORIGIN`, `DEFAULT_PREFIX`, `DATABASE_URL`, `REDIS_URL`, `HEALTH_PORT`, `PLAYER_URL`, `PLAYER_TOKEN`.

Kunci player: `PLAYER_TOKEN` (minimal 16 karakter, sama dengan yang dibaca bot), `PLAYER_HOST`, `PLAYER_PORT`, `YTDLP_PATH`, `FFMPEG_PATH`.

Lokal memakai Postgres dan Redis di `127.0.0.1`. Di Dokploy, `DATABASE_URL` dan `REDIS_URL` diisi dari layanan yang sudah ada. `tsx watch` tidak memuat ulang `.env`. Setelah `.env` berubah, prosesnya harus dinyalakan ulang.

`HEALTH_PORT` lokal bot adalah 8081 karena port 8080 di mesin pengembangan ini dipakai nginx. Di dalam kontainer bot, health tetap 8080 dan tidak dipublikasikan.

## Menjalankan lokal

Butuh yt-dlp dan ffmpeg di PATH mesin yang menjalankan player. Di Mac pengembangan, keduanya dari Homebrew. Bot sendiri tidak memutar file lokal.

```bash
pnpm install
pnpm dev
```

`pnpm dev` menjalankan bot, web, dan player bersamaan.

- Web: http://localhost:3000
- Health bot: http://127.0.0.1:8081/health
- Health player: http://127.0.0.1:8090/health

Player bind ke `127.0.0.1` supaya tidak terbuka ke jaringan.

## Deploy

Dokploy memakai `docker-compose.yml`. Domain dipasang ke service `web` port 3000. Service yang naik: `bot` dan `web`. `DATABASE_URL` dan `REDIS_URL` menunjuk ke Postgres dan Redis yang sudah ada.

Bot tidak punya port publik. Satu replika. `PLAYER_URL` dan `PLAYER_TOKEN` diisi di lingkungan bot.

## Cek

```bash
pnpm typecheck
pnpm test
```
