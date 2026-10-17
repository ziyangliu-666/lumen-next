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

# The readers' Python packages (deploy/sandbox/requirements.txt), built for
# the sandbox's Python: python:3.12-slim-bookworm, the LUMEN_SANDBOX_IMAGE in
# fly.toml. They are mounted read-only into each sandbox, which has no
# network to install them.
FROM python:3.12-slim-bookworm AS sandbox-lib
COPY deploy/sandbox/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --target /opt/sandbox-lib -r /tmp/requirements.txt

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
# Project files live under .data next to the process (LUMEN_VOLUME_ROOT unset).
# The runtime user must own it, or the first file tool a worker calls fails.
RUN mkdir -p /app/.data && chown node:node /app/.data
# The readers' sandbox: a Docker daemon in this machine, started by the
# entrypoint when LUMEN_COMPUTE_PROVIDER=docker. The node user may use it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends docker.io ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && usermod -aG docker node
COPY --from=sandbox-lib /opt/sandbox-lib /opt/sandbox-lib
COPY deploy/fly/entrypoint.sh /usr/local/bin/lumen-entrypoint
# No curl in the slim image; Node is there anyway.
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Starts as root, and drops to node before the server runs (entrypoint.sh).
CMD ["/usr/local/bin/lumen-entrypoint"]
