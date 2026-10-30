import type { Metadata } from "next"

export const metadata: Metadata = { title: "Privacy" }

export default function PrivacyPage() {
  return (
    <main className="page prose">
      <h1>Privacy</h1>
      <p>Iris stores only what she needs to run in a Discord server.</p>
      <h2>What is stored</h2>
      <ul>
        <li>The server ID, server name, a custom prefix, and which commands a manager turned off.</li>
        <li>
          A live alert for one server: the YouTube channel ID and name, whether alerts for it are
          on, the Discord channel that server chose, and the video ID of a stream that was already
          announced there. A manager of that server can change this list on the dashboard.
        </li>
        <li>
          The AI settings a manager saved for one server: the provider, the model, and that
          server&apos;s API key. The key is encrypted with AES-256-GCM before it is stored, it is tied
          to that server and provider, and only its last four characters are ever shown again.
        </li>
        <li>The dashboard session: user ID, display name, avatar, and the Discord OAuth token. The session lives in Redis and expires.</li>
        <li>The server count and a heartbeat time, for the status on the home page.</li>
      </ul>
      <h2>What is not stored</h2>
      <p>Message text is read only to recognize a command. Message text, attachments, and chat history are not written to the database.</p>
      <p>
        Song titles and YouTube links are read to play audio in the voice channel. Audio and
        voice-channel contents are not stored.
      </p>
      <h2>AI questions</h2>
      <p>
        The <code>ask</code> command works only after a server manager adds a key for an AI provider.
        The question, the message it replies to, and the server name are sent to that provider with
        that server&apos;s key, and the provider&apos;s own privacy terms apply. Some free tiers use
        prompts to train models. Iris does not store questions or answers.
      </p>
      <h2>Discord permissions</h2>
      <p>
        The bot uses the Guilds, Guild Messages, Message Content, and Guild Voice States intents.
        Message Content is required so the prefix can be read. Guild Voice States tells Iris which
        voice channel you are in. Message Content is enabled in the Developer Portal. The server
        permissions requested on invite are View Channels, Send Messages, Embed Links, Read Message
        History, Connect, and Speak.
      </p>
    </main>
  )
}
