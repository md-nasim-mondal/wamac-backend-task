FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/admin-service/package.json ./services/admin-service/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/admin-service ./services/admin-service

WORKDIR /app/services/admin-service
RUN npx prisma generate || true
RUN npm run build

EXPOSE 3006
CMD ["npm", "start"]
