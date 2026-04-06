FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/transaction-service/package.json ./services/transaction-service/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/transaction-service ./services/transaction-service

WORKDIR /app/services/transaction-service
RUN npx prisma generate || true
RUN npm run build

EXPOSE 3002
CMD ["npm", "start"]
