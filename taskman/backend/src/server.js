const fastify = require('fastify')({
  logger: {
    level: require('./config').logLevel,
    transport: {
      target: 'pino-pretty'
    }
  }
});

const config = require('./config');
const TaskManager = require('./services/task-manager');

// Register Swagger
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'TaskMan API',
      version: '1.0.0',
      description: 'Task Manager API for AI Development Lifecycle'
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

// Initialize TaskManager
const taskManager = new TaskManager();

fastify.decorate('taskManager', taskManager);

fastify.addHook('onReady', async () => {
  await taskManager.initialize(config);
  fastify.log.info('TaskManager initialized');
  
  const tasks = taskManager.getAllTasks();
  fastify.log.info(`Loaded ${tasks.length} tasks`);
});

fastify.addHook('onClose', async () => {
  await taskManager.close();
  fastify.log.info('TaskManager closed');
});

// Register routes
fastify.register(require('./routes/tasks'));
fastify.register(require('./routes/executions'));
fastify.register(require('./routes/cron'));
fastify.register(require('./routes/reports'));

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
