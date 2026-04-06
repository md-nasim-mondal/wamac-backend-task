const fs = require('fs');
const path = require('path');

const services = [
  'account-service',
  'transaction-service',
  'ledger-service',
  'fx-service',
  'payroll-service',
  'admin-service'
];

const tsconfig = {
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
};

const packageJsonTemplate = (name) => ({
  "name": name,
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "express": "^4.21.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "@prisma/client": "^5.14.0",
    "prom-client": "^15.1.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "ts-node-dev": "^2.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "prisma": "^5.14.0"
  }
});

const dockerfile = `FROM node:20-alpine
WORKDIR /app

# Copy root package.json and workspace definition
COPY package.json ./

# Copy the specific service package.json
COPY services/SERVICE_NAME/package.json ./services/SERVICE_NAME/

# Install dependencies for the workspace
RUN npm install

# Copy source code
COPY services/SERVICE_NAME ./services/SERVICE_NAME

WORKDIR /app/services/SERVICE_NAME
RUN npx prisma generate || true
RUN npm run build

EXPOSE PORT_NUMBER
CMD ["npm", "start"]
`;

const portMap = {
  'account-service': 3001,
  'transaction-service': 3002,
  'ledger-service': 3003,
  'fx-service': 3004,
  'payroll-service': 3005,
  'admin-service': 3006
};

services.forEach(service => {
  const serviceDir = path.join(__dirname, 'services', service);
  fs.mkdirSync(path.join(serviceDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(serviceDir, 'prisma'), { recursive: true });
  
  fs.writeFileSync(path.join(serviceDir, 'package.json'), JSON.stringify(packageJsonTemplate(service), null, 2));
  fs.writeFileSync(path.join(serviceDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(path.join(serviceDir, 'Dockerfile'), dockerfile.replace(/SERVICE_NAME/g, service).replace(/PORT_NUMBER/g, portMap[service]));
  
  // Create basic Prisma schema
  const dbName = service.split('-')[0] + '_db';
  fs.writeFileSync(path.join(serviceDir, 'prisma', 'schema.prisma'), `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n`);
  
  // Create basic src/index.ts
  fs.writeFileSync(path.join(serviceDir, 'src', 'index.ts'), `import express from 'express';\nimport cors from 'cors';\nimport dotenv from 'dotenv';\ndotenv.config();\n\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get('/', (req, res) => { res.send('${service} running'); });\n\nconst port = process.env.PORT || ${portMap[service]};\napp.listen(port, () => console.log('${service} listening on port ' + port));\n`);
});

console.log('Services scaffolded successfully.');
