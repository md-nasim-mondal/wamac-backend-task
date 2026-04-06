FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/fx-service/package.json ./services/fx-service/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/fx-service ./services/fx-service

WORKDIR /app/services/fx-service
RUN npx prisma generate || true
RUN npm run build

EXPOSE 3004
CMD ["npm", "start"]
