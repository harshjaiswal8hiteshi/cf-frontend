# Use Node image
FROM node:18-alpine

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Build Next.js app
RUN npm run build

# Expose the port your app runs on
EXPOSE 3000

# Start the frontend app
CMD ["npm", "start"]
