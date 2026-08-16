# Static UI demo build — all installs happen inside the container (node:24).
#
# Build:  docker build -f web.Dockerfile -t trading-journal-web .
# Run:    docker run --rm -p 3000:3000 trading-journal-web

# ---- deps (install packages inside the container, not on the host) ----
# NOTE: NODE_TLS_REJECT_UNAUTHORIZED=0 works around the corporate TLS-inspecting
# proxy whose CA is not present in the Alpine image. Only affects this build.
FROM node:24-alpine AS deps
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
WORKDIR /app
COPY package.json ./
RUN npm install

# ---- builder ----
FROM node:24-alpine AS builder
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
