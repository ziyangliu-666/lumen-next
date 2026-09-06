# The monolith as one image. Multi-stage: build, then a slim runtime.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/server/package.json apps/server/
RUN npm install
COPY . .
RUN npm run build --workspace @lumen/contracts && npm run build --workspace @lumen/server

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
EXPOSE 4173
USER node
CMD ["node", "apps/server/dist/main.js"]
