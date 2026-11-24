FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts --no-audit && npm run db:generate
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
RUN npm exec -- tsc --noEmit && npm prune --omit=dev --ignore-scripts --no-audit

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4174
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src/model.ts /app/src/googleReviews.ts /app/src/media.ts ./src/
COPY --from=build --chown=node:node /app/server ./server
COPY --chown=node:node package.json ./
USER node
EXPOSE 4174
CMD ["node", "--import", "tsx", "server/index.ts"]
