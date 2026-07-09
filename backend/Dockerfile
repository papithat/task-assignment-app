FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/schema.sql ./dist/db/schema.sql
COPY --from=build /app/src/db/seed.sql ./dist/db/seed.sql

EXPOSE 4000
CMD ["node", "dist/index.js"]
