const TelegramBot = require('node-telegram-bot-api');
const MessagingAdapter = require('./adapter');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class TelegramAdapter extends MessagingAdapter {
  constructor(token, chatId) {
    super();
    this.token = token;
    this.defaultChatId = chatId;
    this.bot = null;
  }
  
  async start() {
    logger.debug('Starting Telegram bot...');
    logger.debug(`Token: ${this.token?.substring(0, 15)}...`);
    logger.debug(`Default Chat ID: ${this.defaultChatId}`);
    
    this.bot = new TelegramBot(this.token, {
      polling: {
        interval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL) || 300,
        autoStart: true,
        params: {
          timeout: parseInt(process.env.TELEGRAM_POLLING_TIMEOUT) || 10
        }
      }
    });
    
    logger.info('Telegram bot started successfully');
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
    logger.debug('Registering message handler...');
    
    this.bot.on('message', async (msg) => {
      logger.debug({
        chatId: msg.chat.id,
        userId: msg.from.id,
        text: msg.text
      }, 'Message received');
      
      const chatId = msg.chat.id;
      const text = msg.text;
      const userId = msg.from.id;
      
      try {
        logger.debug('Calling message handler...');
        await handler(chatId, text, userId);
        logger.debug('Message handler completed');
      } catch (error) {
        logger.error({ err: error }, 'Message handler error');
      }
    });
    
    logger.debug('Message handler registered');
  }
  
  async onButtonClick(handler) {
    logger.debug('Registering button click handler...');
    
    this.bot.on('callback_query', async (query) => {
      logger.debug({
        chatId: query.message.chat.id,
        userId: query.from.id,
        data: query.data
      }, 'Button clicked');
      
      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const [action, data] = query.data.split(':');
      
      try {
        logger.debug('Calling button click handler...');
        await handler(chatId, action, data, userId);
        await this.bot.answerCallbackQuery(query.id);
        logger.debug('Button click handler completed');
      } catch (error) {
        logger.error({ err: error }, 'Button click handler error');
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Error processing request',
          show_alert: true
        });
      }
    });
    
    logger.debug('Button click handler registered');
  }
}

module.exports = TelegramAdapter;
