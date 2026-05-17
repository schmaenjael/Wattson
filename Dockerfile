FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./

# canvas (chartjs-node-canvas) needs native build tools + pixman/cairo/pango headers
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev
RUN bun install --frozen-lockfile --no-progress

# ---

FROM oven/bun:1-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Runtime shared libraries for the canvas native module
RUN apk add --no-cache pixman cairo pango jpeg giflib

COPY --from=build /app/node_modules ./node_modules

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY types ./types
COPY assets ./assets
COPY config ./config
COPY scripts/migrations ./scripts/migrations

# Bun resolves tsconfig paths natively — no tsc compilation needed
CMD ["bun", "run", "./src/index.ts"]
