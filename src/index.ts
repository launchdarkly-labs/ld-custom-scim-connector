/**
 * SCIM Gateway - Main Entry Point
 * 
 * A SCIM middleware service that bridges Alice IdP and LaunchDarkly.
 * Transforms standard SCIM User resources to LaunchDarkly's extended schema.
 */

import express from 'express';
import { loadConfig, AppConfig } from './config/index.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { logger, requestLogger } from './middleware/logging.js';
import { bearerTokenAuth } from './middleware/auth.js';
import { LaunchDarklyScimClient } from './scim/client/launchdarkly.js';
import { createScimRouter } from './scim/server/routes.js';

let config: AppConfig;

// Load configuration
try {
  config = loadConfig();
} catch (error) {
  console.error('Failed to load configuration:', error);
  process.exit(1);
}

// Initialize database
initDatabase(config.databasePath);

// Create Express app
const app = express();

// Middleware
app.use(express.json({ type: ['application/json', 'application/scim+json'] }));
app.use(requestLogger);

// Health check endpoint (unauthenticated)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ready check endpoint (unauthenticated)
app.get('/ready', (_req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Create LaunchDarkly SCIM client
const ldClient = new LaunchDarklyScimClient({
  baseUrl: config.ldScimBaseUrl,
  accessToken: config.ldAccessToken,
});

// SCIM routes (authenticated)
const scimRouter = createScimRouter(config, ldClient);
app.use('/scim/v2', bearerTokenAuth(config.gatewayBearerToken), scimRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: '404',
    detail: 'Resource not found',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err }, 'Unhandled error');
  res.status(500).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: '500',
    detail: 'Internal server error',
  });
});

// Start server
const server = app.listen(config.port, () => {
  logger.info({
    port: config.port,
    ldScimBaseUrl: config.ldScimBaseUrl,
    mappingsCount: config.mappings.roleMappings.length,
    defaultRole: config.mappings.defaultRole,
  }, 'SCIM Gateway started');
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down...');
  server.close(() => {
    closeDatabase();
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

