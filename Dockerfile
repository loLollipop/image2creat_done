FROM node:22-alpine

WORKDIR /app

# Install only production deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the project.
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY database ./database

# Image generation output directory; mounted as a volume in compose.
RUN mkdir -p /app/data/generated

ENV NODE_ENV=production \
    PORT=3000 \
    AI_API_BASE_URL=http://chatgpt2api/v1

EXPOSE 3000

CMD ["node", "server.js"]
