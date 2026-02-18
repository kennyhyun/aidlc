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
const MessagingService = require('./services/messaging-service');

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
const messagingService = new MessagingService();

fastify.decorate('taskManager', taskManager);
fastify.decorate('messagingService', messagingService);

fastify.addHook('onReady', async () => {
  await taskManager.initialize(config);
  fastify.log.info('TaskManager initialized');
  
  const tasks = taskManager.getAllTasks();
  fastify.log.info(`Loaded ${tasks.length} tasks`);
  
  // Initialize messaging service if configured
  if (config.messaging.platform && config.messaging.telegram.token) {
    await messagingService.initialize(config.messaging);
    fastify.log.info(`Messaging service initialized with ${config.messaging.platform}`);
    
    // Setup event listeners
    taskManager.on('task:started', (data) => {
      messagingService.notifyTaskStarted(data.taskId, data.taskName, data.executionId);
    });
    
    taskManager.on('task:completed', (data) => {
      messagingService.notifyTaskCompleted(data.taskId, data.taskName, data.executionId, data.duration);
    });
    
    taskManager.on('task:failed', (data) => {
      messagingService.notifyTaskFailed(data.taskId, data.taskName, data.executionId, data.error);
    });
    
    // Setup custom message handler for natural language
    messagingService.onMessage(async (chatId, text, userId) => {
      const tasks = taskManager.getAllTasks();
      const running = taskManager.getRunningTasks();
      
      // Build context for LLM
      const context = {
        available_tasks: tasks.map(t => ({
          id: t.id,
          name: t.name,
          command: t.command,
          needs: t.needs || []
        })),
        running_tasks: running.map(t => ({
          id: t.id,
          task_id: t.task_id,
          task_name: t.task_name,
          started_at: t.started_at
        })),
        api_base_url: `http://localhost:${config.port}/api`
      };
      
      try {
        // Use Kiro CLI for natural language understanding
        const KiroWrapper = require('./services/kiro-wrapper');
        const kiro = new KiroWrapper();
        
        const response = await kiro.chat(text, context);
        
        await messagingService.sendMessage(chatId, response);
      } catch (error) {
        fastify.log.error('LLM processing error:', error?.message);
        
        // Fallback to simple keyword matching
        if (text.includes('상태') || text.includes('status')) {
          if (running.length === 0) {
            await messagingService.sendMessage(chatId, '✅ 실행 중인 태스크가 없습니다.');
          } else {
            const status = running.map(t => 
              `⏳ ${t.task_name} (${t.task_id})\n   시작: ${t.started_at}`
            ).join('\n\n');
            await messagingService.sendMessage(chatId, `📊 실행 중인 태스크:\n\n${status}`);
          }
        } else if (text.includes('목록') || text.includes('list')) {
          const list = tasks.map(t => `• ${t.name} (${t.id})`).join('\n');
          await messagingService.sendMessage(chatId, `📋 사용 가능한 태스크:\n\n${list}`);
        } else if (text.includes('실행') || text.includes('run')) {
          const taskName = text.replace(/실행|run/gi, '').trim();
          const task = tasks.find(t => 
            t.name.toLowerCase().includes(taskName.toLowerCase()) ||
            t.id.includes(taskName)
          );
          
          if (task) {
            try {
              const result = await taskManager.executeTask(task.id, 'telegram');
              await messagingService.sendMessage(
                chatId,
                `▶️ 태스크 시작: ${task.name}\n실행 ID: ${result.id}`
              );
            } catch (error) {
              await messagingService.sendMessage(chatId, `❌ 오류: ${error?.message}`);
            }
          } else {
            await messagingService.sendMessage(chatId, '❓ 태스크를 찾을 수 없습니다.');
          }
        } else {
          await messagingService.sendMessage(
            chatId,
            `❌ LLM 처리 실패: ${error?.message}\n\n사용 가능한 명령:\n• "상태" - 실행 중인 태스크 확인\n• "목록" - 태스크 목록\n• "실행 [태스크명]" - 태스크 실행\n• /help - 도움말`
          );
        }
      }
    });
  } else {
    fastify.log.info('Messaging service not configured');
  }
});

fastify.addHook('onClose', async () => {
  await messagingService.stop();
  await taskManager.close();
  fastify.log.info('Services closed');
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
