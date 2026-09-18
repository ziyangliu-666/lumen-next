# The monolith as one image: the server, the built web app it serves, and the
# migrations it runs at startup. Multi-stage: build, then a slim runtime.
FROM node:22-slim AS build
WORKDIR /app
# Manifests first, so that a change to source does not invalidate the install.
COPY package.json package-lock.json .npmrc* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build --workspace @lumen/contracts \
 && npm run build --workspace @lumen/server \
 && npm run build --workspace @lumen/web
# What production needs to run, and nothing the build needed.
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV LUMEN_PORT=4000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
# dist carries the compiled server and, beside db.js, the .sql migrations.
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
# main.js serves this directory when it exists (defaultWebRoot in core/http/server.ts).
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 4000
USER node
# No curl in the slim image; Node is there anyway.
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "apps/server/dist/main.js"]
