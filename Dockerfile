FROM oven/bun:latest

COPY package*.json ./
COPY bun.lock ./
COPY tsconfig.json ./

COPY bot.config.ts ./

COPY src ./src
COPY types ./types
COPY scripts ./scripts
COPY assets ./assets

RUN bun install --frozen-lockfile --no-progress
RUN bun run build

RUN bun run ./build/scripts/register-commands.js

CMD "bun" "start"