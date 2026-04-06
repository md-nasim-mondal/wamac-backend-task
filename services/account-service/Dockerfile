FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/account-service/package.json ./services/account-service/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/account-service ./services/account-service

WORKDIR /app/services/account-service
RUN npx prisma generate || true
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
