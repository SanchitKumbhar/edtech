FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
