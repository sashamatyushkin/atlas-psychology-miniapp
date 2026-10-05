# Бэкенд Атласа: API + бот. Фронтенд деплоится отдельно (GitHub Pages / любой static-хостинг).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional && npm cache clean --force
COPY tsconfig*.json ./
COPY src/domain ./src/domain
COPY server ./server
ENV NODE_ENV=production PORT=8080 DATA_FILE=/data/db.json
VOLUME ["/data"]
EXPOSE 8080
USER node
CMD ["npx", "tsx", "server/index.ts"]
