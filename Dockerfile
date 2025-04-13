FROM oven/bun:latest

COPY package.json ./
COPY bun.lock ./
COPY src ./

RUN bun install
RUN bun run build

CMD "bun" "start"