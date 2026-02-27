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
const WorkspaceService = require('./services/workspace-service');
const DatabaseModel = require('./models/database');
const KiroWrapper = require('./services/kiro-wrapper');

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

// Initialize database and workspace service
const db = new DatabaseModel(config.database?.path || './data/taskman.db');
let workspaceService;

fastify.decorate('taskManager', taskManager);
fastify.decorate('messagingService', messagingService);

fastify.addHook('onReady', async () => {
  // Initialize database
  await db.initialize();
  fastify.log.info('Database initialized');
  
  // Initialize workspace service
  workspaceService = new WorkspaceService(db, taskManager);
  workspaceService.ensureDefaultWorkspace();
  fastify.log.info('Workspace service initialized');
  
  // Decorate fastify with workspace service for routes
  fastify.decorate('workspaceService', workspaceService);
  
  await taskManager.initialize(config);
  fastify.log.info('TaskManager initialized');
  
  const tasks = taskManager.getAllTasks();
  fastify.log.info(`Loaded ${tasks.length} tasks`);
  
  // Initialize messaging service if configured
  fastify.log.debug('Checking messaging config...');
  fastify.log.debug(`Platform: ${config.messaging.platform}`);
  fastify.log.debug(`Slack botToken: ${config.messaging.slack.botToken ? 'SET' : 'NOT SET'}`);
  fastify.log.debug(`Telegram token: ${config.messaging.telegram.token ? 'SET' : 'NOT SET'}`);
  
  const hasMessagingConfig = config.messaging.platform && (
    (config.messaging.platform === 'telegram' && config.messaging.telegram.token) ||
    (config.messaging.platform === 'slack' && config.messaging.slack.botToken)
  );
  
  fastify.log.debug(`hasMessagingConfig: ${hasMessagingConfig}`);
  
  if (hasMessagingConfig) {
    fastify.log.debug('Initializing messaging service...');
    
    // Set workspace service before initializing messaging
    messagingService.setWorkspaceService(workspaceService);
    
    // Create KiroWrapper instance and set it in messaging service
    const kiroWrapper = new KiroWrapper(workspaceService);
    messagingService.setKiroWrapper(kiroWrapper);
    
    await messagingService.initialize({
      ...config.messaging,
      database: db
    });
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
      let typingMessage = null;
      
      try {
        fastify.log.debug(`Received message from ${userId}: ${text}`);
        
        // Send typing indicator (Slack: temporary message, Telegram: typing action)
        fastify.log.debug('Sending typing indicator...');
        typingMessage = await messagingService.sendTyping(chatId);
        fastify.log.debug('Typing indicator sent');
        
        const tasks = taskManager.getAllTasks();
        const running = taskManager.getRunningTasks();
        
        fastify.log.debug(`Available tasks: ${tasks.length}, Running tasks: ${running.length}`);
        
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
        
        fastify.log.debug('Context built, initializing Kiro CLI...');
        
        // Use Kiro CLI for natural language understanding
        const kiro = new KiroWrapper(workspaceService);
        
        fastify.log.debug('Calling Kiro CLI chat with streaming...');
        
        // Track accumulated output
        let accumulatedOutput = '';
        
        const response = await kiro.chat(text, context, async (progressLine) => {
          try {
            if (typingMessage?.update) {
              // Accumulate all output
              accumulatedOutput += (accumulatedOutput ? '\n' : '') + progressLine;
              // Update the same message (throttler will batch these)
              await typingMessage.update(accumulatedOutput);
            }
          } catch (err) {
            fastify.log.error(`Error sending progress update: ${err?.message}`);
          }
        });
        
        fastify.log.debug(`Got final response from Kiro CLI (${response.length} chars)`);
        
        // Flush any pending throttled updates
        if (typingMessage?.flush) {
          await typingMessage.flush();
        }
        
        // Check if response is a JSON action
        try {
          const jsonMatch = response.match(/\{[^}]*"action"[^}]*\}/);
          if (jsonMatch) {
            const action = JSON.parse(jsonMatch[0]);
            if (action.action === 'execute' && action.task_id) {
              fastify.log.info(`Executing task: ${action.task_id}`);
              
              const result = await taskManager.executeTask(action.task_id, 'telegram');
              const message = `▶️ 태스크 시작: ${action.task_id}\n실행 ID: ${result.id}`;
              
              // Update the typing message with final result
              if (typingMessage?.update) {
                await typingMessage.update(message);
                await typingMessage.flush();
              } else {
                await messagingService.sendMessage(chatId, message);
              }
              
              fastify.log.info('Task execution initiated');
              return;
            }
          }
        } catch (parseError) {
          fastify.log.debug('Response is not a JSON action, sending as text');
        }
        
        // Update with final response if no progress was sent
        if (!accumulatedOutput && typingMessage?.update) {
          await typingMessage.update(response);
          await typingMessage.flush();
        } else if (!accumulatedOutput) {
          await messagingService.sendMessage(chatId, response);
        }
        // Otherwise, progress updates already sent everything
        
        fastify.log.info('Message sent successfully');
      } catch (error) {
        fastify.log.error(`Error in message handler: ${error?.message}`);
        fastify.log.error(`Stack: ${error?.stack}`);
        
        // Only use fallback for command-like messages (starting with !)
        if (text.startsWith('!')) {
          await messagingService.sendMessage(
            chatId,
            `❌ 명령 처리 실패: ${error?.message}\n\n!help를 입력하여 사용 가능한 명령을 확인하세요.`
          );
          return;
        }
        
        // For natural language, provide helpful error message
        await messagingService.sendMessage(
          chatId,
          `❌ 요청 처리 중 오류가 발생했습니다.\n\n오류: ${error?.message}\n\n명령어를 사용하려면 !help를 입력하세요.`
        );
      }
    });
  } else {
    fastify.log.info('Messaging service not configured');
  }
});

fastify.addHook('onClose', async () => {
  await messagingService.stop();
  await taskManager.close();
  if (db) {
    await db.close();
  }
  fastify.log.info('Services closed');
});

// Register routes
fastify.register(require('./routes/tasks'));
fastify.register(require('./routes/executions'));
fastify.register(require('./routes/cron'));
fastify.register(require('./routes/reports'));
fastify.register(require('./routes/workspace'));

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
