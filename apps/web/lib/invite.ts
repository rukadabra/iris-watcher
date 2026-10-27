import { inviteUrl } from "@iris/shared"

export function readInviteUrl(): string | null {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) return null
  return inviteUrl(clientId)
}
