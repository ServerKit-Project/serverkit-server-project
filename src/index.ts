import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

import {
  createAuthMiddleware,
  createRoleCheckMiddleware,
  createContextMiddleware,
  notFoundMiddleware,
  errorMiddleware,
} from '@/middlewares';

import { TokenService, AuthService, UserService, FileService } from '@/service';

import apiRoutes from '@/controller';
import { RoleTreeNode, ApiSpec } from '@/interface';

// Load environment variables
config();

// Global variables
let prisma: PrismaClient;
let tokenService: TokenService;
let authService: AuthService;
let userService: UserService;
let fileService: FileService;

// Initialize Prisma
function initializePrisma(): void {
  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

  // Make prisma globally available (similar to mock implementation)
  (global as any).prisma = prisma;
}

// Load JWT keys
function loadJWTKeys(): { privateKey: string; publicKey: string } {
  const keysPath = path.join(process.cwd(), 'keys');

  let privateKey = process.env.JWT_PRIVATE_KEY;
  let publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    try {
      privateKey = fs.readFileSync(
        path.join(keysPath, 'private_key.pem'),
        'utf8'
      );
      publicKey = fs.readFileSync(
        path.join(keysPath, 'public_key.pem'),
        'utf8'
      );
    } catch (error) {
      console.error(
        '❌ Failed to load JWT keys from files. Please set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables.'
      );
      process.exit(1);
    }
  }

  return { privateKey, publicKey };
}

// Load role tree configuration
function loadRoleTree(): RoleTreeNode {
  try {
    const roleTreePath = path.join(process.cwd(), 'roleTree.json');
    if (fs.existsSync(roleTreePath)) {
      return JSON.parse(fs.readFileSync(roleTreePath, 'utf8'));
    }
  } catch (error) {
    console.warn(
      '⚠️ Role tree configuration not found, using empty configuration'
    );
  }

  return {
    path: '/',
    children: [],
  };
}

// Load API specifications
function loadApiSpecs(): ApiSpec {
  try {
    const apiSpecsPath = path.join(process.cwd(), 'api-specs.json');
    if (fs.existsSync(apiSpecsPath)) {
      return JSON.parse(fs.readFileSync(apiSpecsPath, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️ API specs not found, using default configuration');
  }

  return {
    version: '1.0.0',
    endpoints: [
      {
        path: '/auth/register',
        method: 'POST',
        description: 'Register new user',
      },
      { path: '/auth/login', method: 'POST', description: 'User login' },
      {
        path: '/auth/refresh',
        method: 'POST',
        description: 'Refresh access token',
      },
      {
        path: '/users/me',
        method: 'GET',
        description: 'Get current user profile',
      },
      {
        path: '/files/upload',
        method: 'POST',
        description: 'Upload single file',
      },
      { path: '/files/:id', method: 'GET', description: 'Get file by ID' },
    ],
  };
}

// Initialize all services
async function initializeServices(): Promise<void> {
  console.log('🚀 Initializing services...');

  // Initialize Prisma
  initializePrisma();
  console.log('✅ Prisma initialized');

  // Load JWT keys and initialize TokenService
  const { privateKey, publicKey } = loadJWTKeys();
  tokenService = new TokenService(privateKey, publicKey);
  console.log('✅ TokenService initialized');

  // Initialize other services
  authService = new AuthService(prisma, tokenService);
  userService = new UserService(prisma);
  fileService = new FileService(prisma);
  console.log('✅ All services initialized');
}

// Configure Morgan logging
function configureMorgan(app: express.Application): void {
  if (process.env.NODE_ENV !== 'production') {
    // Development mode with detailed logging
    morgan.token('body', (req: express.Request) => {
      if (
        req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PATCH'
      ) {
        return JSON.stringify(req.body);
      }
      return '-';
    });

    morgan.token('query', (req: express.Request) => {
      return Object.keys(req.query).length > 0
        ? JSON.stringify(req.query)
        : '-';
    });

    const devFormat =
      ':method :url HTTP/:http-version :status :response-time ms - Query: :query - Body: :body';

    app.use(
      morgan(devFormat, {
        skip: (req: express.Request) => {
          return req.path.includes('/file/');
        },
      })
    );

    console.log('🔍 HTTP Request logging enabled (development mode)');
  } else {
    // Production mode with simple logging
    app.use(morgan('combined'));
  }
}

// Create and configure Express app
function createApp(): express.Application {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Configure logging
  configureMorgan(app);

  // Load configurations
  const roleTree = loadRoleTree();
  const apiSpecs = loadApiSpecs();

  // Authentication middleware
  app.use(createAuthMiddleware(tokenService));

  // Context middleware
  app.use(createContextMiddleware());

  // Role-based access control
  app.use(createRoleCheckMiddleware(roleTree));

  // API routes
  app.use('/api', apiRoutes);

  // Health check endpoint
  app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // Handshake endpoint (API discovery)
  app.get('/handshake', (req: express.Request, res: express.Response) => {
    res.json(apiSpecs);
  });

  // Default route
  app.get('/', (req: express.Request, res: express.Response) => {
    res.json({
      message: 'ServerKit Server is running',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        handshake: '/handshake',
        api: '/api',
      },
    });
  });

  // Error handling middleware
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

// Global error handlers
function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (err: Error) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🔄 SIGINT received, shutting down gracefully');
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Main function to start the server
async function main(): Promise<void> {
  try {
    // Setup global error handlers
    setupGlobalErrorHandlers();

    // Initialize services
    await initializeServices();

    // Create Express app
    const app = createApp();

    // Get port from environment
    const PORT = process.env.PORT || 3000;

    if (isNaN(Number(PORT))) {
      throw new Error(`Invalid PORT value: ${PORT}`);
    }

    // Start server
    app.listen(Number(PORT), () => {
      console.log('✅ Server is running on port:', PORT);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 API specs: http://localhost:${PORT}/handshake`);
      console.log(`🚀 API base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  console.error('❌ Startup error:', error);
  process.exit(1);
});

export { prisma, tokenService, authService, userService, fileService };
