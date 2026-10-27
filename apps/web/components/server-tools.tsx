"use client"

import { useActionState } from "react"
import { addWatch, saveAlertChannel, setCommandEnabled, updateWatch } from "@/app/dashboard/actions"
import type { PrefixActionState } from "@/lib/types"

const initialState: PrefixActionState = { error: "", saved: false }

const YOUTUBE_CHANNEL_ID = /^UC[\w-]{22}$/
const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/

type Watch = {
  youtubeChannelId: string
  name: string
  enabled: boolean
  liveVideoId: string | null
}

type TextChannel = {
  id: string
  name: string
}

export function WatchPanel({
  guildId,
  channelId,
  channelName,
  channels,
  watches,
}: {
  guildId: string
  channelId: string | null
  channelName?: string
  channels: TextChannel[]
  watches: Watch[]
}) {
  const count = watches.length === 1 ? "1 channel" : `${watches.length} channels`
  const known = channels.some((channel) => channel.id === channelId)
  const options = known || !channelId || !channelName ? channels : [{ id: channelId, name: channelName }, ...channels]

  return (
    <section className="block" aria-label="YouTube live alerts">
      <div className="block-head">
        <h3>YouTube live</h3>
        <p className="meta">{watches.length === 0 ? "None yet" : count}</p>
      </div>
      <AlertChannelForm guildId={guildId} channelId={channelId} channelName={channelName} channels={options} />
      {watches.length === 0 ? (
        <p className="meta">No YouTube channels yet.</p>
      ) : (
        <ul className="watch-list">
          {watches.map((watch) => (
            <WatchRow key={watch.youtubeChannelId} guildId={guildId} watch={watch} />
          ))}
        </ul>
      )}
      <AddWatchForm guildId={guildId} />
    </section>
  )
}

function AlertChannelForm({
  guildId,
  channelId,
  channelName,
  channels,
}: {
  guildId: string
  channelId: string | null
  channelName?: string
  channels: TextChannel[]
}) {
  const [state, action, pending] = useActionState(saveAlertChannel, initialState)
  if (channels.length === 0) {
    return (
      <p className="meta">
        {channelName ? `Alerts go to #${channelName}. ` : ""}
        The channel list could not be loaded.
      </p>
    )
  }

  return (
    <form action={action} className="prefix-row">
      <input type="hidden" name="guildId" value={guildId} />
      <select name="channelId" aria-label="Alert channel" defaultValue={channelId ?? ""} required>
        <option value="" disabled>
          Choose a channel
        </option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        Save
      </button>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.saved ? <p className="form-ok">Alert channel saved.</p> : null}
    </form>
  )
}

function AddWatchForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(addWatch, initialState)
  return (
    <form action={action} className="prefix-row">
      <input type="hidden" name="guildId" value={guildId} />
      <input
        name="target"
        aria-label="YouTube channel"
        placeholder="@handle or channel link"
        maxLength={200}
        spellCheck={false}
        required
      />
      <button type="submit" disabled={pending}>
        Add
      </button>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.saved ? <p className="form-ok">Channel added.</p> : null}
    </form>
  )
}

function WatchRow({ guildId, watch }: { guildId: string; watch: Watch }) {
  const channelUrl = YOUTUBE_CHANNEL_ID.test(watch.youtubeChannelId)
    ? `https://www.youtube.com/channel/${watch.youtubeChannelId}`
    : null
  const videoUrl =
    watch.enabled && watch.liveVideoId && YOUTUBE_VIDEO_ID.test(watch.liveVideoId)
      ? `https://www.youtube.com/watch?v=${watch.liveVideoId}`
      : null

  return (
    <li className={watch.enabled ? undefined : "is-off"}>
      {channelUrl ? (
        <a className="watch-name" href={channelUrl} target="_blank" rel="noopener noreferrer">
          {watch.name}
        </a>
      ) : (
        <span className="watch-name">{watch.name}</span>
      )}
      <div className="watch-actions">
        {videoUrl ? (
          <a className="pill live" href={videoUrl} target="_blank" rel="noopener noreferrer">
            Live
          </a>
        ) : (
          <span className="pill idle">{watch.enabled ? "Not live" : "Off"}</span>
        )}
        <WatchIntent
          guildId={guildId}
          youtubeChannelId={watch.youtubeChannelId}
          intent={watch.enabled ? "off" : "on"}
          label={watch.enabled ? "On" : "Off"}
          pressed={watch.enabled}
        />
        <WatchIntent
          guildId={guildId}
          youtubeChannelId={watch.youtubeChannelId}
          intent="delete"
          label="Delete"
          confirmName={watch.name}
        />
      </div>
    </li>
  )
}

function WatchIntent({
  guildId,
  youtubeChannelId,
  intent,
  label,
  pressed,
  confirmName,
}: {
  guildId: string
  youtubeChannelId: string
  intent: "on" | "off" | "delete"
  label: string
  pressed?: boolean
  confirmName?: string
}) {
  const [state, action, pending] = useActionState(updateWatch, initialState)
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmName && !window.confirm(`Remove ${confirmName} from this server?`)) event.preventDefault()
      }}
    >
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="youtubeChannelId" value={youtubeChannelId} />
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        className={intent === "delete" ? "quiet" : pressed ? "switch" : "switch off"}
        aria-pressed={pressed}
        disabled={pending}
      >
        {label}
      </button>
      {state.error ? <p className="form-error">{state.error}</p> : null}
    </form>
  )
}

export function CommandPanel({
  guildId,
  groups,
  commands,
  disabled,
}: {
  guildId: string
  groups: Array<{ id: string; label: string }>
  commands: Array<{ name: string; emoji: string; summary: string; group: string; locked: boolean }>
  disabled: string[]
}) {
  const off = new Set(disabled)
  return (
    <section className="block" aria-label="Commands">
      <div className="block-head">
        <h3>Commands</h3>
      </div>
      <p className="meta">Help and prefix stay available. Turn the others off for this server only.</p>
      <div className="command-groups">
        {groups.map((group) => {
          const items = commands.filter((command) => command.group === group.id)
          if (items.length === 0) return null
          return (
            <section key={group.id} className="command-group" aria-label={group.label}>
              <h4>{group.label}</h4>
              <ul className="command-switches">
                {items.map((command) =>
                  command.locked ? (
                    <li key={command.name} className="command-switch">
                      <span>
                        {command.emoji} {command.name}
                      </span>
                      <span className="pill idle">Always on</span>
                    </li>
                  ) : (
                    <CommandSwitch
                      key={command.name}
                      guildId={guildId}
                      name={command.name}
                      emoji={command.emoji}
                      summary={command.summary}
                      enabled={!off.has(command.name)}
                    />
                  ),
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function CommandSwitch({
  guildId,
  name,
  emoji,
  summary,
  enabled,
}: {
  guildId: string
  name: string
  emoji: string
  summary: string
  enabled: boolean
}) {
  const [state, action, pending] = useActionState(setCommandEnabled, initialState)
  return (
    <li className="command-switch">
      <form action={action}>
        <input type="hidden" name="guildId" value={guildId} />
        <input type="hidden" name="command" value={name} />
        <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
        <button type="submit" className={enabled ? "switch" : "switch off"} aria-pressed={enabled} disabled={pending} title={summary}>
          {emoji} {name}
          <span>{enabled ? "On" : "Off"}</span>
        </button>
      </form>
      {state.error ? <p className="form-error">{state.error}</p> : null}
    </li>
  )
}
