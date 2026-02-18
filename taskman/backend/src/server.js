const fastify = require('fastify')({
  logger: {
    level: require('./config').logLevel,
    transport: {
      target: 'pino-pretty'
    }
  }
});

const config = require('./config');
const Database = require('./models/database');

// Register Swagger
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'AIDLC API',
      version: '1.0.0',
      description: 'AI Development Lifecycle Controller API'
    }
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs'
});

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Initialize database
let db;

fastify.addHook('onReady', async () => {
  db = new Database(config.database.path);
  await db.initialize();
  fastify.log.info('Database initialized');
});

fastify.addHook('onClose', async () => {
  if (db) {
    await db.close();
    fastify.log.info('Database closed');
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${config.port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
