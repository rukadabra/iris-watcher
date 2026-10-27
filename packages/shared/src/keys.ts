export const PREFIX_CHANNEL = "iris:prefix"
export const COMMANDS_CHANNEL = "iris:commands"
export const LIVE_REFRESH_CHANNEL = "iris:live-refresh"
export const STATS_GUILDS_KEY = "iris:stats:guilds"
export const STATS_HEARTBEAT_KEY = "iris:stats:heartbeat"

export function guildPrefixKey(guildId: string): string {
  return `guild:${guildId}:prefix`
}

export function guildCommandsKey(guildId: string): string {
  return `guild:${guildId}:commands`
}

export function sessionKey(sessionId: string): string {
  return `session:${sessionId}`
}

export function oauthStateKey(state: string): string {
  return `oauth-state:${state}`
}
