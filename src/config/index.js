require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 8254,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    path: process.env.DATABASE_PATH || './data/aidlc.db'
  },
  
  messaging: {
    platform: process.env.MESSAGING_PLATFORM || 'telegram',
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      pollingInterval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL) || 300,
      pollingTimeout: parseInt(process.env.TELEGRAM_POLLING_TIMEOUT) || 10
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      channelId: process.env.SLACK_CHANNEL_ID
    }
  },
  
  tasks: {
    maxConcurrent: Math.min(Math.max(parseInt(process.env.MAX_CONCURRENT_TASKS) || 3, 1), 8),
    configDir: process.env.TASK_CONFIG_DIR || './config/tasks',
    reloadDebounce: parseInt(process.env.TASK_RELOAD_DEBOUNCE) || 60000
  },
  
  kiro: {
    configPath: process.env.KIRO_CONFIG_PATH || '/root/.kiro'
  }
};
