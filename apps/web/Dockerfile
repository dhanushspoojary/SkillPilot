FROM node:22-alpine AS deps
WORKDIR /app
# Use wildcard to gracefully handle missing package-lock.json
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --include=dev --ignore-scripts --no-audit --no-fund; else npm install --include=dev --ignore-scripts --no-audit --no-fund; fi
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck && npm run build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
COPY --from=build --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=nextjs:nodejs /app/scripts/prune.mjs ./scripts/prune.mjs
COPY --from=build --chown=nextjs:nodejs /app/db/migrations ./db/migrations
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node","server.js"]
