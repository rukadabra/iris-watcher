export type PrefixActionState = {
  error: string
  saved: boolean
}

export type Session = {
  id: string
  userId: string
  username: string
  avatar: string | null
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type DiscordUser = {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
}

export type DiscordToken = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type DiscordGuild = {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string
}
