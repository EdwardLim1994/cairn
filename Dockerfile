FROM oven/bun:1.4.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts && bun run nuxt prepare

COPY . .
RUN bun run build
RUN bun build scripts/migrate.mjs --target=node --format=cjs --outfile=/app/migrate.cjs

FROM node:22-alpine AS runtime
WORKDIR /app

ENV DATABASE_URL="" \
    OTEL_COLLECTOR_URL="" \
    PROJECT_ID="" \
    PORT=3001 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY --from=build /app/migrate.cjs ./migrate.cjs
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3001
CMD ["sh", "-c", "node migrate.cjs && exec node .output/server/index.mjs"]
