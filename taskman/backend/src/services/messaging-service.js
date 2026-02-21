const TelegramAdapter = require('./messaging/telegram-adapter');
const SlackAdapter = require('./messaging/slack-adapter');

class MessagingService {
  constructor() {
    this.adapter = null;
    this.platform = null;
    this.messageHandler = null;
    this.buttonHandler = null;
  }
  
  async initialize(config) {
    console.log('[MessagingService] Initializing...');
    console.log('[MessagingService] Platform:', config.platform);
    
    this.platform = config.platform || 'telegram';
    
    if (this.platform === 'telegram') {
      console.log('[MessagingService] Creating Telegram adapter...');
      this.adapter = new TelegramAdapter(
        config.telegram.token,
        config.telegram.chatId
      );
    } else if (this.platform === 'slack') {
      console.log('[MessagingService] Creating Slack adapter...');
      console.log('[MessagingService] Bot Token:', config.slack.botToken?.substring(0, 15) + '...');
      console.log('[MessagingService] App Token:', config.slack.appToken?.substring(0, 15) + '...');
      console.log('[MessagingService] Channel ID:', config.slack.channelId);
      
      this.adapter = new SlackAdapter(
        config.slack.botToken,
        config.slack.appToken,
        config.slack.channelId
      );
    } else {
      throw new Error(`Unsupported messaging platform: ${this.platform}`);
    }
    
    console.log('[MessagingService] Starting adapter...');
    await this.adapter.start();
    console.log('[MessagingService] ✅ Adapter started');
    
    this.registerHandlers();
    console.log('[MessagingService] ✅ Initialization complete');
  }
  
  registerHandlers() {
    console.log('[MessagingService] Registering handlers...');
    
    // Message handler
    this.adapter.onMessage(async (chatId, text, userId) => {
      console.log('[MessagingService] 📨 Message received:', { chatId, text, userId });
      await this.handleMessage(chatId, text, userId);
    });
    
    // Button click handler
    this.adapter.onButtonClick(async (chatId, action, data, userId) => {
      console.log('[MessagingService] 🔘 Button clicked:', { chatId, action, data, userId });
      await this.handleButtonClick(chatId, action, data, userId);
    });
    
    console.log('[MessagingService] ✅ Handlers registered');
  }
  
  async handleMessage(chatId, text, userId) {
    // 1. Commands with ! prefix (Slack-friendly)
    if (text.startsWith('!')) {
      return await this.handleCommand(chatId, text);
    }
    
    // 2. Legacy slash commands for Telegram compatibility
    if (text.startsWith('/') && this.platform === 'telegram') {
      return await this.handleCommand(chatId, text);
    }
    
    // 3. Natural language - delegate to custom handler
    if (this.messageHandler) {
      await this.adapter.sendTyping(chatId);
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
${prefix}help - Show this help message

You can also use natural language:
"빌드 상태 알려줘"
"백엔드 빌드 돌려줘"
"로그 보여줘"
    `.trim();
    
    await this.adapter.sendMessage(chatId, help);
  }
  
  async handleButtonClick(chatId, action, data, userId) {
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
  
  // Custom handler registration
  onMessage(handler) {
    this.messageHandler = handler;
  }
  
  onButtonClick(handler) {
    this.buttonHandler = handler;
  }
  
  // Notification methods
  async notifyTaskStarted(taskId, taskName, executionId) {
    const message = `▶️ Task started: ${taskName}\nID: ${taskId}\nExecution: ${executionId}`;
    await this.adapter.sendMessage(null, message);
  }
  
  async notifyTaskCompleted(taskId, taskName, executionId, duration) {
    const message = `✅ Task completed: ${taskName}\nDuration: ${duration}s`;
    const buttons = [
      { text: '🔄 Rerun', action: 'rerun', data: taskId },
      { text: '📜 Logs', action: 'logs', data: String(executionId) }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async notifyTaskFailed(taskId, taskName, executionId, error) {
    const message = `❌ Task failed: ${taskName}\nError: ${error}`;
    const buttons = [
      { text: '🔄 Retry', action: 'rerun', data: taskId },
      { text: '📜 Logs', action: 'logs', data: String(executionId) }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async sendDailyReport() {
    const report = await this.generateDailyReport();
    await this.adapter.sendMessage(null, report);
  }
  
  async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    
    return `📊 Daily Report (${today})\n\nNo executions recorded yet.`;
  }
  
  async sendMessage(chatId, text, options = {}) {
    return this.adapter.sendMessage(chatId, text, options);
  }
  
  async sendTyping(chatId) {
    return this.adapter.sendTyping(chatId);
  }
  
  async stop() {
    if (this.adapter) {
      await this.adapter.stop();
    }
  }
}

module.exports = MessagingService;
