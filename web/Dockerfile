# =====================================================================
# Next.js frontend for image2creat_done (GPT Image Studio).
#
# Uses Next.js standalone output:
#   https://nextjs.org/docs/app/api-reference/config/next-config-js/output
#
# The container runs on port 3001 and is expected to be reachable from
# the legacy Node.js backend (port 3000) so API requests can be routed
# back through nginx (or another reverse proxy) in production.
# =====================================================================

# ---------------- Build stage ----------------
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps in a separate layer for caching.
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy the rest of the web source.
COPY web/ ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------- Runtime stage ----------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

# Pull the minimal runtime tree out of the build stage.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001

CMD ["node", "server.js"]
