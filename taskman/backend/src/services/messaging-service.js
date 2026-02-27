const TelegramAdapter = require('./messaging/telegram-adapter');
const SlackAdapter = require('./messaging/slack-adapter');
const KiroWrapper = require('./kiro-wrapper');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class MessagingService {
  constructor() {
    this.adapter = null;
    this.platform = null;
    this.messageHandler = null;
    this.buttonHandler = null;
    this.workspaceService = null;
    this.kiroWrapper = null;
  }
  
  async initialize(config) {
    this.taskManager = config.taskManager;
    this.workspaceService = config.workspaceService;
    this.database = config.database;
    
    logger.debug('Initializing messaging service...');
    logger.debug(`Platform: ${config.platform}`);
    
    // Validate ALLOWED_USER_IDS is configured
    const allowedUsers = process.env.ALLOWED_USER_IDS?.split(',').map(id => id.trim()).filter(id => id) || [];
    if (allowedUsers.length === 0) {
      logger.warn('⚠️  ALLOWED_USER_IDS not configured - messaging integration disabled');
      logger.warn('⚠️  Set ALLOWED_USER_IDS in .env to enable messaging');
      return; // Skip initialization
    }
    logger.info(`Access control enabled for ${allowedUsers.length} user(s)`);
    
    this.platform = config.platform || 'telegram';
    
    if (this.platform === 'telegram') {
      logger.debug('Creating Telegram adapter...');
      this.adapter = new TelegramAdapter(
        config.telegram.token,
        config.telegram.chatId
      );
    } else if (this.platform === 'slack') {
      logger.debug('Creating Slack adapter...');
      logger.debug(`Bot Token: ${config.slack.botToken?.substring(0, 15)}...`);
      logger.debug(`App Token: ${config.slack.appToken?.substring(0, 15)}...`);
      logger.debug(`Channel ID: ${config.slack.channelId}`);
      
      this.adapter = new SlackAdapter(
        config.slack.botToken,
        config.slack.appToken,
        config.slack.channelId
      );
    } else {
      throw new Error(`Unsupported messaging platform: ${this.platform}`);
    }
    
    logger.debug('Starting adapter...');
    await this.adapter.start();
    logger.info('Messaging adapter started');
    
    // Initialize Kiro wrapper with workspace service and database
    const kiroWrapper = new KiroWrapper(this.workspaceService, this.database);
    this.setKiroWrapper(kiroWrapper);
    
    this.registerHandlers();
    logger.info('Messaging service initialized');
  }
  
  registerHandlers() {
    logger.debug('Registering message handlers...');
    
    // Message handler
    this.adapter.onMessage(async (chatId, text, userId) => {
      logger.debug({ chatId, text, userId }, 'Message received');
      await this.handleMessage(chatId, text, userId);
    });
    
    // Button click handler
    this.adapter.onButtonClick(async (chatId, action, data, userId) => {
      logger.debug({ chatId, action, data, userId }, 'Button clicked');
      await this.handleButtonClick(chatId, action, data, userId);
    });
    
    logger.debug('Message handlers registered');
  }
  
  async handleMessage(chatId, text, userId) {
    // Ignore messages without text
    if (!text || typeof text !== 'string') {
      logger.debug('Ignoring message without text');
      return;
    }
    
    // Access control: Check if user is allowed
    if (!this.isUserAllowed(userId)) {
      logger.debug(`Ignored message from unauthorized user: ${userId}`);
      return;
    }
    
    // 1. Commands with ! prefix (Slack-friendly)
    if (text.startsWith('!')) {
      return await this.handleCommand(chatId, text);
    }
    
    // 2. Legacy slash commands for Telegram compatibility
    if (text.startsWith('/') && this.platform === 'telegram') {
      return await this.handleCommand(chatId, text);
    }
    
    // 3. Natural language - use Kiro for processing
    if (this.kiroWrapper) {
      try {
        // Send typing indicator
        this.sendTyping(chatId);
        
        // Build context
        const context = {
          // Add any necessary context here
        };
        
        // Send to Kiro for processing
        const response = await this.kiroWrapper.chat(
          text,
          context,
          (chunk) => {
            this.sendTyping(chatId);
          },
          chatId
        );
        
        return await this.adapter.sendMessage(chatId, response);
      } catch (error) {
        return await this.adapter.sendMessage(
          chatId,
          `❌ Error: ${error?.message}`
        );
      }
    }
    
    // Fallback to custom handler if set
    if (this.messageHandler) {
      return await this.messageHandler(chatId, text, userId);
    }
    
    // Default response
    await this.adapter.sendMessage(
      chatId,
      '❓ Unknown command. Type !help for available commands.'
    );
  }
  
  async handleCommand(chatId, text) {
    const [command, ...args] = text.split(' ');
    const cmd = command.replace(/^[!/]/, ''); // Remove ! or / prefix
    
    try {
      switch (cmd) {
        case 'status':
          return await this.cmdStatus(chatId);
        case 'list':
          return await this.cmdList(chatId);
        case 'run':
          return await this.cmdRun(chatId, args[0]);
        case 'cancel':
          return await this.cmdCancel(chatId, args[0]);
        case 'logs':
          return await this.cmdLogs(chatId, args[0]);
        case 'report':
          return await this.cmdReport(chatId);
        case 'workspace':
          return await this.cmdWorkspace(chatId, args);
        case 'bye':
          return await this.cmdBye(chatId);
        case 'help':
          return await this.cmdHelp(chatId);
        default:
          const prefix = this.platform === 'slack' ? '!' : '/';
          return await this.adapter.sendMessage(
            chatId,
            `❓ Unknown command. Type ${prefix}help for available commands.`
          );
      }
    } catch (error) {
      await this.adapter.sendMessage(
        chatId,
        `❌ Error: ${error?.message}`
      );
    }
  }
  
  async cmdStatus(chatId) {
    await this.adapter.sendMessage(chatId, '✅ Service is running');
  }
  
  async cmdList(chatId) {
    await this.adapter.sendMessage(chatId, '📋 No tasks configured');
  }
  
  async cmdRun(chatId, taskId) {
    if (!taskId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /run <task-id>'
      );
    }
    
    await this.adapter.sendMessage(chatId, `▶️ Task started: ${taskId}`);
  }
  
  async cmdCancel(chatId, executionId) {
    if (!executionId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /cancel <execution-id>'
      );
    }
    
    await this.adapter.sendMessage(chatId, `⏸️ Task cancelled: ${executionId}`);
  }
  
  async cmdLogs(chatId, executionId) {
    if (!executionId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /logs <execution-id>'
      );
    }
    
    await this.adapter.sendMessage(chatId, `📜 Logs for execution ${executionId}`);
  }
  
  async cmdReport(chatId) {
    const report = await this.generateDailyReport();
    await this.adapter.sendMessage(chatId, report);
  }
  
  async cmdBye(chatId) {
    if (!this.kiroWrapper) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Kiro service not available'
      );
    }
    
    try {
      const response = await this.kiroWrapper.clearSessionForCurrentWorkspace(chatId);
      await this.adapter.sendMessage(chatId, response);
    } catch (error) {
      await this.adapter.sendMessage(
        chatId,
        `❌ Error clearing session: ${error?.message}`
      );
    }
  }

  async cmdHelp(chatId) {
    const prefix = this.platform === 'slack' ? '!' : '/';
    const help = `
📋 TaskMan Commands

${prefix}status - Show running tasks
${prefix}list - List all available tasks
${prefix}run <task-id> - Execute a task
${prefix}cancel <execution-id> - Cancel running task
${prefix}logs <execution-id> - View task logs
${prefix}report - Generate daily report
${prefix}workspace - Show current workspace
${prefix}workspace <path> - Switch workspace
${prefix}workspace list - List recent workspaces
${prefix}workspace default - Switch to default workspace
${prefix}workspace default <path> - Set default workspace
${prefix}bye - Clear Kiro session
${prefix}help - Show this help message

You can also use natural language:
"빌드 상태 알려줘"
"백엔드 빌드 돌려줘"
"로그 보여줘"
    `.trim();
    
    await this.adapter.sendMessage(chatId, help);
  }

  async cmdWorkspace(chatId, args) {
    if (!this.workspaceService) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Workspace service not available'
      );
    }
    
    // !workspace (show current)
    if (args.length === 0) {
      const current = this.workspaceService.getCurrentWorkspace();
      if (!current) {
        return await this.adapter.sendMessage(
          chatId,
          '📂 현재 워크스페이스가 설정되지 않았습니다'
        );
      }
      return await this.adapter.sendMessage(
        chatId,
        `📂 현재 워크스페이스: ${current.path}\n접근 횟수: ${current.access_count}`
      );
    }
    
    // !workspace list
    if (args[0] === 'list') {
      const workspaces = this.workspaceService.listWorkspaces(5);
      if (workspaces.length === 0) {
        return await this.adapter.sendMessage(
          chatId,
          '📂 워크스페이스 히스토리가 없습니다'
        );
      }
      
      const list = workspaces.map((ws, idx) => {
        const current = ws.is_current ? '✓ ' : '  ';
        const defaultMark = ws.is_default ? '⭐ ' : '';
        return `${idx + 1}. ${current}${defaultMark}${ws.path} (${ws.access_count}회)`;
      }).join('\n');
      
      return await this.adapter.sendMessage(
        chatId,
        `📂 최근 워크스페이스:\n${list}`
      );
    }
    
    // !workspace default (switch to default)
    if (args[0] === 'default' && args.length === 1) {
      try {
        const workspace = this.workspaceService.switchToDefault();
        return await this.adapter.sendMessage(
          chatId,
          `✅ 디폴트 워크스페이스로 전환: ${workspace.path}`
        );
      } catch (error) {
        return await this.adapter.sendMessage(
          chatId,
          `❌ ${error.message}`
        );
      }
    }
    
    // !workspace default <path> (set default)
    if (args[0] === 'default' && args.length > 1) {
      const path = args.slice(1).join(' ');
      try {
        this.workspaceService.setDefaultWorkspace(path);
        return await this.adapter.sendMessage(
          chatId,
          `✅ 디폴트 워크스페이스 설정: ${path}`
        );
      } catch (error) {
        return await this.adapter.sendMessage(
          chatId,
          `❌ ${error.message}`
        );
      }
    }
    
    // !workspace <path> (switch)
    const path = args.join(' ');
    const oldWorkspace = this.workspaceService.getCurrentWorkspace();
    
    try {
      const workspace = this.workspaceService.switchWorkspace(path);
      
      let message = `✅ 워크스페이스 전환: ${workspace.path}`;
      
      if (oldWorkspace && oldWorkspace.path !== workspace.path) {
        message += `\n\n이전 워크스페이스(${oldWorkspace.path})의 세션은 보존되어 있습니다.`;
        message += `\n해당 워크스페이스로 돌아가면 대화를 이어갈 수 있습니다.`;
      }
      
      return await this.adapter.sendMessage(chatId, message);
    } catch (error) {
      return await this.adapter.sendMessage(
        chatId,
        `❌ ${error.message}`
      );
    }
  }
  
  async handleButtonClick(chatId, action, data, userId) {
    // Access control: Check if user is allowed
    if (!this.isUserAllowed(userId)) {
      logger.debug(`Ignored button click from unauthorized user: ${userId}`);
      return;
    }
    
    if (this.buttonHandler) {
      return await this.buttonHandler(chatId, action, data, userId);
    }
    
    // Default button handling
    switch (action) {
      case 'cancel':
        await this.cmdCancel(chatId, data);
        break;
      case 'logs':
        await this.cmdLogs(chatId, data);
        break;
      case 'rerun':
        await this.cmdRun(chatId, data);
        break;
      default:
        await this.adapter.sendMessage(chatId, `Unknown action: ${action}`);
    }
  }
  
  isUserAllowed(userId) {
    const allowedUsers = process.env.ALLOWED_USER_IDS?.split(',').map(id => id.trim()).filter(id => id) || [];
    
    // ALLOWED_USER_IDS is required - reject if not configured
    if (allowedUsers.length === 0) {
      logger.warn('ALLOWED_USER_IDS not configured - rejecting all users');
      return false;
    }
    
    // Check if user is in allowed list
    return allowedUsers.includes(String(userId));
  }
  
  // Custom handler registration
  onMessage(handler) {
    this.messageHandler = handler;
  }
  
  onButtonClick(handler) {
    this.buttonHandler = handler;
  }

  setWorkspaceService(workspaceService) {
    this.workspaceService = workspaceService;
  }
  setKiroWrapper(kiroWrapper) {
    this.kiroWrapper = kiroWrapper;
  }
  
  // Notification methods
  async notifyTaskStarted(taskId, taskName, executionId) {
    if (!this.adapter) return; // Skip if not initialized
    const message = `▶️ Task started: ${taskName}\nID: ${taskId}\nExecution: ${executionId}`;
    await this.adapter.sendMessage(null, message);
  }
  
  async notifyTaskCompleted(taskId, taskName, executionId, duration) {
    if (!this.adapter) return; // Skip if not initialized
    const message = `✅ Task completed: ${taskName}\nDuration: ${duration}s`;
    const buttons = [
      { text: '🔄 Rerun', action: 'rerun', data: taskId },
      { text: '📜 Logs', action: 'logs', data: String(executionId) }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async notifyTaskFailed(taskId, taskName, executionId, error) {
    if (!this.adapter) return; // Skip if not initialized
    const message = `❌ Task failed: ${taskName}\nError: ${error}`;
    const buttons = [
      { text: '🔄 Retry', action: 'rerun', data: taskId },
      { text: '📜 Logs', action: 'logs', data: String(executionId) }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async sendDailyReport() {
    if (!this.adapter) return; // Skip if not initialized
    const report = await this.generateDailyReport();
    await this.adapter.sendMessage(null, report);
  }
  
  async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    
    return `📊 Daily Report (${today})\n\nNo executions recorded yet.`;
  }
  
  async sendMessage(chatId, text, options = {}) {
    if (!this.adapter) return; // Skip if not initialized
    return this.adapter.sendMessage(chatId, text, options);
  }
  
  async sendTyping(chatId) {
    if (!this.adapter) return; // Skip if not initialized
    return this.adapter.sendTyping(chatId);
  }
  
  async stop() {
    if (this.adapter) {
      await this.adapter.stop();
    }
  }
}

module.exports = MessagingService;
