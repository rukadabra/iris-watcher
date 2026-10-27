FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/player/package.json apps/player/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/player apps/player
RUN pnpm --filter @iris/player build
RUN pnpm --filter @iris/player deploy --legacy --prod /out

FROM node:24-alpine AS runner
RUN apk add --no-cache ffmpeg yt-dlp
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
COPY --from=build /app/apps/player/dist ./dist
CMD ["node", "dist/index.js"]
