FROM oven/bun:1.4.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts && bun run nuxt prepare

COPY . .
RUN bun run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV CAIRN_DATA_DIR="/app/data" \
    OTEL_COLLECTOR_URL="" \
    PROJECT_ID="" \
    PORT=3003 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/drizzle-sqlite ./drizzle-sqlite

EXPOSE 3003
CMD ["node", ".output/server/index.mjs"]
