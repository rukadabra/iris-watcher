import { createServer, type Server } from "node:http"

export type HealthStatus = {
  ok: boolean
  guilds: number
}

export function startHealth(port: number, status: () => HealthStatus): Server {
  const server = createServer((request, response) => {
    if (request.url !== "/health") {
      response.writeHead(404)
      response.end()
      return
    }
    const body = status()
    response.writeHead(body.ok ? 200 : 503, { "content-type": "application/json" })
    response.end(JSON.stringify(body))
  })
  server.listen(port, "0.0.0.0")
  return server
}
