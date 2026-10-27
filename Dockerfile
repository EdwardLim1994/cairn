FROM oven/bun:1.4.4 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts && bun run nuxt prepare

COPY . .
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV DATABASE_URL="" \
    OTEL_COLLECTOR_URL="" \
    PROJECT_ID="" \
    PORT=3001 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3001
CMD ["node", ".output/server/index.mjs"]
