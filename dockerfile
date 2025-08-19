# ---------- Build Stage ----------
FROM node:20-slim AS builder
WORKDIR /app

# Copy only package files first (better caching)
COPY package*.json ./

# Install deps (no scripts yet)
RUN npm ci --ignore-scripts

# Copy rest of the code
COPY . .

# Build TypeScript -> dist/
RUN npm run build

# ---------- Runtime Stage ----------
FROM ghcr.io/puppeteer/puppeteer:23.0.0
WORKDIR /app

# Copy only what's needed for runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts

# Expose backend port
EXPOSE 8000

CMD ["node", "dist/index.js"]
