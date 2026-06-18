# WaveThree — Docker image para NaN.builders
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web-viewer/package.json apps/web-viewer/
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/web-viewer/dist ./dist
COPY --from=builder /app/apps/web-viewer/server.mjs ./server.mjs
EXPOSE 3500
CMD ["node", "server.mjs"]