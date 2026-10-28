# The platform image: the same server and web app as the root Dockerfile, for
# the services on Kubernetes. Two differences, both from the image scan in the
# deploy pipeline:
#
# - No Docker engine and no sandbox packages. The monolith runs readers'
#   commands in local Docker containers; the platform's workers run with
#   LUMEN_COMPUTE_PROVIDER=none. The docker.io package carried a critical CVE
#   and about half of the image's size.
# - Debian security updates are installed at build time, so a fixed CVE in the
#   base image (perl-base, for example) does not wait for a new node image.
#
# Each Deployment starts its own entry point (node apps/server/dist/services/
# <name>.js), so there is no ENTRYPOINT script here.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build --workspace @lumen/contracts \
 && npm run build --workspace @lumen/server \
 && npm run build --workspace @lumen/web
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV LUMEN_PORT=4000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 4000
CMD ["node", "apps/server/dist/services/session.js"]
