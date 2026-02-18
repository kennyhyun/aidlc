# Messaging Platform Detailed Design

**Date:** 2026-02-18  
**Component:** Messaging Platform (Telegram & Slack)  
**Parent Design:** [AIDLC System Design](./2026-02-18-aidlc-design.md)

## Overview

The Messaging Platform provides a unified interface for user interaction via Telegram or Slack. It supports both slash commands for direct API calls and natural language processing via LLM for flexible user interaction.

## Responsibilities

- Receive messages from Telegram or Slack
- Route slash commands to direct handlers
- Process natural language via Kiro CLI (LLM)
- Send responses and notifications
- Generate context-aware buttons
- Handle button click callbacks
- Send automatic notifications (task status changes, daily reports)

## Architecture

### Adapter Pattern

```
┌─────────────────────────────────────┐
│     Messaging Service (Core)        │
│  - Message routing                  │
│  - Command handling                 │
│  - LLM integration                  │
│  - Notification management          │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────┐
│  Telegram   │  │   Slack    │
│  Adapter    │  │  Adapter   │
└─────────────┘  └────────────┘
```

### Abstract Interface

```javascript
// src/services/messaging/adapter.js
class MessagingAdapter {
  /**
   * Send a text message
   * @param {string} chatId - Chat/channel ID
   * @param {string} text - Message text
   * @param {Object} options - Platform-specific options
   * @param {Array} options.buttons - Button array
   * @returns {Promise<Object>} Message info
   */
  async sendMessage(chatId, text, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Send typing indicator
   * @param {string} chatId - Chat/channel ID
   */
  async sendTyping(chatId) {
    throw new Error('Not implemented');
  }
  
  /**
   * Register message handler
   * @param {Function} handler - async (chatId, text, userId) => void
   */
  async onMessage(handler) {
    throw new Error('Not implemented');
  }
  
  /**
   * Register button click handler
   * @param {Function} handler - async (chatId, action, data, userId) => void
   */
  async onButtonClick(handler) {
    throw new Error('Not implemented');
  }
  
  /**
   * Start listening for messages
   */
  async start() {
    throw new Error('Not implemented');
  }
  
  /**
   * Stop listening
   */
  async stop() {
    throw new Error('Not implemented');
  }
}

module.exports = MessagingAdapter;
```

## Platform Adapters

### Telegram Adapter

```javascript
// src/services/messaging/telegram-adapter.js
const TelegramBot = require('node-telegram-bot-api');
const MessagingAdapter = require('./adapter');

class TelegramAdapter extends MessagingAdapter {
  constructor(token, chatId) {
    super();
    this.token = token;
    this.defaultChatId = chatId;
    this.bot = null;
  }
  
  async start() {
    this.bot = new TelegramBot(this.token, {
      polling: {
        interval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL) || 300,
        autoStart: true,
        params: {
          timeout: parseInt(process.env.TELEGRAM_POLLING_TIMEOUT) || 10
        }
      }
    });
    
    logger.info('Telegram bot started');
  }
  
  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
  }
  
  async sendMessage(chatId, text, options = {}) {
    const { buttons } = options;
    const opts = {};
    
    if (buttons && buttons.length > 0) {
      opts.reply_markup = {
        inline_keyboard: [
          buttons.map(btn => ({
            text: btn.text,
            callback_data: `${btn.action}:${btn.data}`
          }))
        ]
      };
    }
    
    return this.bot.sendMessage(chatId || this.defaultChatId, text, opts);
  }
  
  async sendTyping(chatId) {
    return this.bot.sendChatAction(chatId || this.defaultChatId, 'typing');
  }
  
  async onMessage(handler) {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      const userId = msg.from.id;
      
      try {
        await handler(chatId, text, userId);
      } catch (error) {
        logger.error('Telegram message handler error:', error?.message);
      }
    });
  }
  
  async onButtonClick(handler) {
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const [action, data] = query.data.split(':');
      
      try {
        await handler(chatId, action, data, userId);
        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        logger.error('Telegram button handler error:', error?.message);
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Error processing request',
          show_alert: true
        });
      }
    });
  }
}

module.exports = TelegramAdapter;
```

### Slack Adapter

```javascript
// src/services/messaging/slack-adapter.js
const { App } = require('@slack/bolt');
const MessagingAdapter = require('./adapter');

class SlackAdapter extends MessagingAdapter {
  constructor(botToken, appToken, channelId) {
    super();
    this.botToken = botToken;
    this.appToken = appToken;
    this.defaultChannelId = channelId;
    this.app = null;
  }
  
  async start() {
    this.app = new App({
      token: this.botToken,
      socketMode: true,
      appToken: this.appToken
    });
    
    await this.app.start();
    logger.info('Slack bot started (Socket Mode)');
  }
  
  async stop() {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
  }
  
  async sendMessage(channelId, text, options = {}) {
    const { buttons } = options;
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text
        }
      }
    ];
    
    if (buttons && buttons.length > 0) {
      blocks.push({
        type: 'actions',
        elements: buttons.map(btn => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: btn.text
          },
          action_id: `${btn.action}:${btn.data}`
        }))
      });
    }
    
    return this.app.client.chat.postMessage({
      channel: channelId || this.defaultChannelId,
      text,
      blocks
    });
  }
  
  async sendTyping(channelId) {
    // Slack doesn't have a typing indicator in the same way
    // We can send a temporary message instead
    return this.app.client.chat.postMessage({
      channel: channelId || this.defaultChannelId,
      text: '🤔 Processing...'
    });
  }
  
  async onMessage(handler) {
    this.app.message(async ({ message, say }) => {
      const channelId = message.channel;
      const text = message.text;
      const userId = message.user;
      
      // Ignore bot messages
      if (message.bot_id) return;
      
      try {
        await handler(channelId, text, userId);
      } catch (error) {
        logger.error('Slack message handler error:', error?.message);
      }
    });
  }
  
  async onButtonClick(handler) {
    this.app.action(/.*/, async ({ action, ack, body }) => {
      await ack();
      
      const channelId = body.channel.id;
      const userId = body.user.id;
      const [actionType, data] = action.action_id.split(':');
      
      try {
        await handler(channelId, actionType, data, userId);
      } catch (error) {
        logger.error('Slack button handler error:', error?.message);
      }
    });
  }
}

module.exports = SlackAdapter;
```

## Messaging Service (Core)

```javascript
// src/services/messaging-service.js
const TelegramAdapter = require('./messaging/telegram-adapter');
const SlackAdapter = require('./messaging/slack-adapter');
const kiroWrapper = require('./kiro-wrapper');
const taskManager = require('./task-manager');

class MessagingService {
  constructor() {
    this.adapter = null;
    this.platform = null;
  }
  
  async initialize() {
    const platform = process.env.MESSAGING_PLATFORM || 'telegram';
    this.platform = platform;
    
    if (platform === 'telegram') {
      this.adapter = new TelegramAdapter(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.TELEGRAM_CHAT_ID
      );
    } else if (platform === 'slack') {
      this.adapter = new SlackAdapter(
        process.env.SLACK_BOT_TOKEN,
        process.env.SLACK_APP_TOKEN,
        process.env.SLACK_CHANNEL_ID
      );
    } else {
      throw new Error(`Unsupported messaging platform: ${platform}`);
    }
    
    await this.adapter.start();
    this.registerHandlers();
    
    logger.info(`Messaging service initialized with ${platform}`);
  }
  
  registerHandlers() {
    // Message handler
    this.adapter.onMessage(async (chatId, text, userId) => {
      await this.handleMessage(chatId, text, userId);
    });
    
    // Button click handler
    this.adapter.onButtonClick(async (chatId, action, data, userId) => {
      await this.handleButtonClick(chatId, action, data, userId);
    });
  }
  
  async handleMessage(chatId, text, userId) {
    logger.info(`Message from ${userId}: ${text}`);
    
    // 1. Slash commands - direct execution
    if (text.startsWith('/')) {
      return await this.handleCommand(chatId, text);
    }
    
    // 2. Natural language - LLM processing
    await this.adapter.sendTyping(chatId);
    
    try {
      const tasks = await taskManager.getAllTasks();
      const runningTasks = await taskManager.getRunningTasks();
      
      const response = await kiroWrapper.chat(text, {
        context: {
          available_tasks: tasks,
          running_tasks: runningTasks,
          api_base_url: `http://localhost:${process.env.PORT}/api`
        },
        tools: this.getApiTools()
      });
      
      const buttons = this.generateContextButtons(response.context);
      
      await this.adapter.sendMessage(chatId, response.message, { buttons });
    } catch (error) {
      logger.error('LLM processing error:', error?.message);
      await this.adapter.sendMessage(
        chatId,
        `❌ Error: ${error?.message}`
      );
    }
  }
  
  async handleCommand(chatId, text) {
    const [command, ...args] = text.split(' ');
    
    try {
      switch (command) {
        case '/status':
          return await this.cmdStatus(chatId);
        case '/list':
          return await this.cmdList(chatId);
        case '/run':
          return await this.cmdRun(chatId, args[0]);
        case '/cancel':
          return await this.cmdCancel(chatId, args[0]);
        case '/logs':
          return await this.cmdLogs(chatId, args[0]);
        case '/report':
          return await this.cmdReport(chatId);
        case '/help':
          return await this.cmdHelp(chatId);
        default:
          return await this.adapter.sendMessage(
            chatId,
            '❓ Unknown command. Type /help for available commands.'
          );
      }
    } catch (error) {
      logger.error(`Command ${command} error:`, error?.message);
      await this.adapter.sendMessage(
        chatId,
        `❌ Error: ${error?.message}`
      );
    }
  }
  
  async cmdStatus(chatId) {
    const running = await taskManager.getRunningTasks();
    
    if (running.length === 0) {
      return await this.adapter.sendMessage(chatId, '✅ No tasks running');
    }
    
    const status = running.map(task => 
      `⏳ ${task.task_name} (${task.id})\n   Started: ${task.started_at}`
    ).join('\n\n');
    
    await this.adapter.sendMessage(chatId, `📊 Running Tasks:\n\n${status}`);
  }
  
  async cmdList(chatId) {
    const tasks = await taskManager.getAllTasks();
    
    const list = tasks.map(task => 
      `• ${task.name} (${task.id})`
    ).join('\n');
    
    await this.adapter.sendMessage(chatId, `📋 Available Tasks:\n\n${list}`);
  }
  
  async cmdRun(chatId, taskId) {
    if (!taskId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /run <task-id>'
      );
    }
    
    const execution = await taskManager.executeTask(taskId);
    
    await this.adapter.sendMessage(
      chatId,
      `▶️ Task started: ${taskId}\nExecution ID: ${execution.id}`,
      {
        buttons: [
          { text: '⏸️ Cancel', action: 'cancel', data: execution.id },
          { text: '📜 Logs', action: 'logs', data: execution.id }
        ]
      }
    );
  }
  
  async cmdCancel(chatId, executionId) {
    if (!executionId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /cancel <execution-id>'
      );
    }
    
    await taskManager.cancelExecution(executionId);
    
    await this.adapter.sendMessage(
      chatId,
      `⏸️ Task cancelled: ${executionId}`
    );
  }
  
  async cmdLogs(chatId, executionId) {
    if (!executionId) {
      return await this.adapter.sendMessage(
        chatId,
        '❌ Usage: /logs <execution-id>'
      );
    }
    
    const logs = await taskManager.getExecutionLogs(executionId);
    
    const message = `📜 Logs for execution ${executionId}:\n\n` +
      `Status: ${logs.status}\n` +
      `Duration: ${logs.duration}s\n\n` +
      `STDOUT:\n${logs.stdout || '(empty)'}\n\n` +
      `STDERR:\n${logs.stderr || '(empty)'}`;
    
    await this.adapter.sendMessage(chatId, message);
  }
  
  async cmdReport(chatId) {
    const report = await this.generateDailyReport();
    await this.adapter.sendMessage(chatId, report);
  }
  
  async cmdHelp(chatId) {
    const help = `
📋 AIDLC Commands

/status - Show running tasks
/list - List all available tasks
/run <task-id> - Execute a task
/cancel <execution-id> - Cancel running task
/logs <execution-id> - View task logs
/report - Generate daily report
/help - Show this help message

You can also use natural language:
"빌드 상태 알려줘"
"백엔드 빌드 돌려줘"
"로그 보여줘"
    `.trim();
    
    await this.adapter.sendMessage(chatId, help);
  }
  
  async handleButtonClick(chatId, action, data, userId) {
    logger.info(`Button click from ${userId}: ${action}:${data}`);
    
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
        logger.warn(`Unknown button action: ${action}`);
    }
  }
  
  generateContextButtons(context) {
    if (!context) return [];
    
    if (context.running_task) {
      return [
        { text: '⏸️ Cancel', action: 'cancel', data: context.execution_id },
        { text: '📜 Logs', action: 'logs', data: context.execution_id }
      ];
    }
    
    if (context.completed_task) {
      return [
        { text: '🔄 Rerun', action: 'rerun', data: context.task_id },
        { text: '📜 Logs', action: 'logs', data: context.execution_id }
      ];
    }
    
    return [];
  }
  
  getApiTools() {
    return [
      {
        name: 'get_task_status',
        description: 'Get current status of running tasks',
        parameters: {
          task_id: { type: 'string', optional: true }
        }
      },
      {
        name: 'execute_task',
        description: 'Execute a task',
        parameters: {
          task_id: { type: 'string', required: true }
        }
      },
      {
        name: 'cancel_task',
        description: 'Cancel a running task',
        parameters: {
          execution_id: { type: 'number', required: true }
        }
      },
      {
        name: 'get_logs',
        description: 'Get execution logs',
        parameters: {
          execution_id: { type: 'number', required: true }
        }
      }
    ];
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
      { text: '📜 Logs', action: 'logs', data: executionId }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async notifyTaskFailed(taskId, taskName, executionId, error) {
    const message = `❌ Task failed: ${taskName}\nError: ${error}`;
    const buttons = [
      { text: '🔄 Retry', action: 'rerun', data: taskId },
      { text: '📜 Logs', action: 'logs', data: executionId }
    ];
    await this.adapter.sendMessage(null, message, { buttons });
  }
  
  async sendDailyReport() {
    const report = await this.generateDailyReport();
    await this.adapter.sendMessage(null, report);
  }
  
  async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const executions = await taskManager.getExecutionsByDate(today);
    
    const total = executions.length;
    const success = executions.filter(e => e.status === 'success').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    
    let report = `📊 Daily Report (${today})\n\n`;
    report += `Total: ${total} | ✅ ${success} | ❌ ${failed}\n\n`;
    
    if (failed > 0) {
      report += `Failed Tasks:\n`;
      executions
        .filter(e => e.status === 'failed')
        .forEach(e => {
          report += `• ${e.task_name} (${e.started_at})\n`;
        });
    }
    
    return report;
  }
  
  async stop() {
    if (this.adapter) {
      await this.adapter.stop();
    }
  }
}

module.exports = new MessagingService();
```

## Configuration

### Environment Variables

```bash
# Platform selection
MESSAGING_PLATFORM=telegram  # telegram or slack

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_POLLING_INTERVAL=300  # ms
TELEGRAM_POLLING_TIMEOUT=10    # seconds

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL_ID=C1234567890
```

## Notification Events

The messaging service listens to task manager events:

```javascript
// In task-manager.js
const EventEmitter = require('events');

class TaskManager extends EventEmitter {
  async executeTask(taskId) {
    const execution = await this.startExecution(taskId);
    
    // Emit event
    this.emit('task:started', {
      taskId,
      taskName: task.name,
      executionId: execution.id
    });
    
    // ... execution logic
    
    if (success) {
      this.emit('task:completed', {
        taskId,
        taskName: task.name,
        executionId: execution.id,
        duration: execution.duration
      });
    } else {
      this.emit('task:failed', {
        taskId,
        taskName: task.name,
        executionId: execution.id,
        error: error.message
      });
    }
  }
}

// In messaging-service.js initialization
taskManager.on('task:started', (data) => {
  messagingService.notifyTaskStarted(
    data.taskId,
    data.taskName,
    data.executionId
  );
});

taskManager.on('task:completed', (data) => {
  messagingService.notifyTaskCompleted(
    data.taskId,
    data.taskName,
    data.executionId,
    data.duration
  );
});

taskManager.on('task:failed', (data) => {
  messagingService.notifyTaskFailed(
    data.taskId,
    data.taskName,
    data.executionId,
    data.error
  );
});
```

## Daily Report Scheduling

```javascript
// In server.js
const cron = require('node-cron');

// Schedule daily report at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  await messagingService.sendDailyReport();
});
```

## Error Handling

- Network errors: Retry with exponential backoff
- Invalid commands: Send help message
- LLM errors: Fallback to error message
- Button click errors: Show alert to user

## Testing Considerations

- Mock adapters for unit tests
- Test command parsing
- Test button generation
- Test notification delivery
- Test LLM integration
- Test error handling

## Security Considerations

- Validate user IDs (optional: whitelist)
- Rate limiting on commands
- Sanitize user input before LLM
- Secure token storage (environment variables)

## Future Enhancements

- Multi-user support with permissions
- Message threading (Slack)
- Rich formatting (code blocks, tables)
- File attachments (logs, reports)
- Interactive forms
- Scheduled messages
- Message editing/deletion
- Conversation history
