FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html portal.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
COPY assets/brand ./assets/brand
COPY assets/manifest.js ./assets/manifest.js
RUN npm run build
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server/*.ts server/schema.sql ./server/
COPY src/festival.ts ./src/festival.ts
COPY assets/brand ./assets/brand
COPY assets/images ./assets/images
COPY assets/models/player-web.glb ./assets/models/player-web.glb
USER node
EXPOSE 8140
CMD ["npm", "start"]
