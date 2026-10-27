import type { Metadata } from "next"

export const metadata: Metadata = { title: "Terms" }

export default function TermsPage() {
  return (
    <main className="page prose">
      <h1>Terms</h1>
      <p>By inviting Iris to a server, the server manager agrees to these terms.</p>
      <ul>
        <li>A prefix belongs to one server and can be returned to the default at any time.</li>
        <li>Only a member with Manage Server can change the prefix from the dashboard.</li>
        <li>
          A member with Manage Server can watch up to 50 YouTube channels for that server, turn one
          off, or remove it. The alert channel is chosen per server, and each server keeps its own
          list. The same manager can turn commands off for that server. Help and the prefix stay on.
        </li>
        <li>Do not use the bot to disrupt a server or break Discord's terms.</li>
        <li>
          Iris can join a voice channel and play a title or a YouTube link.
        </li>
        <li>A server manager can remove Iris at any time. A saved prefix remains if the bot is invited back.</li>
      </ul>
    </main>
  )
}
