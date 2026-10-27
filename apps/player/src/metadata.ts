const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export type YoutubeMeta = {
  id: string
  title: string
}

export function parseMetadata(stdout: string): YoutubeMeta[] {
  const tracks: YoutubeMeta[] = []
  const seen = new Set<string>()

  for (const line of stdout.split("\n")) {
    const [id, title] = line.split("\u001f")
    if (!id || !VIDEO_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    tracks.push({ id, title: title?.trim() || id })
  }

  return tracks
}
