import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger';
import { apiLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';

import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import analyticsRoutes from './routes/analytics';
import categoriesRoutes from './routes/categories';
import syncRoutes from './routes/sync';
import emailParseRoutes from './routes/email-parse';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: false,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Kharchaaa API Docs',
}));

// Root endpoint - API info
app.get('/', (_req, res) => {
  res.json({
    name: 'Kharchaaa API',
    version: '1.0.0',
    description: 'Personal Finance Manager Backend API',
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      auth: '/api/auth',
      transactions: '/api/transactions',
      analytics: '/api/analytics',
      categories: '/api/categories',
      sync: '/api/sync',
    },
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/email', emailParseRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
