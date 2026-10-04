# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# OpenSSL is required by the Prisma query engine on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=15169 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 --create-home lotus
COPY --from=build --chown=lotus /app/package.json /app/package-lock.json ./
COPY --from=build --chown=lotus /app/node_modules ./node_modules
COPY --from=build --chown=lotus /app/.next ./.next
COPY --from=build --chown=lotus /app/public ./public
COPY --from=build --chown=lotus /app/prisma ./prisma
COPY --from=build --chown=lotus /app/scripts ./scripts
COPY --from=build --chown=lotus /app/src ./src
COPY --from=build --chown=lotus /app/content ./content
COPY --from=build --chown=lotus /app/tsconfig.json /app/next.config.mjs ./
COPY --chown=lotus deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER lotus
EXPOSE 15169
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://127.0.0.1:15169/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "next", "start", "-p", "15169", "-H", "0.0.0.0"]
