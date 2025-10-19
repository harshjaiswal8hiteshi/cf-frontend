# Use Node image
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Configure npm to avoid hanging
RUN npm config set fetch-retry-maxtimeout 60000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000 && \
    npm config set registry https://registry.npmjs.org/

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with multiple fallback strategies
RUN npm ci --prefer-offline --no-audit --maxsockets=1 2>/dev/null \
    || npm ci --no-audit --maxsockets=1 2>/dev/null \
    || npm install --prefer-offline --no-audit --maxsockets=1 \
    || npm install --no-audit --maxsockets=1

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]