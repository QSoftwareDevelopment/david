FROM node:22-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci
COPY server ./server
COPY supabase ./supabase
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npx", "tsx", "src/main.ts"]
