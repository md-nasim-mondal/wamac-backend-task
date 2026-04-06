FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/payroll-service/package.json ./services/payroll-service/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/payroll-service ./services/payroll-service

WORKDIR /app/services/payroll-service
RUN npx prisma generate || true
RUN npm run build

EXPOSE 3005
CMD ["npm", "start"]
