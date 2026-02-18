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
        // Error handling
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
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Error processing request',
          show_alert: true
        });
      }
    });
  }
}

module.exports = TelegramAdapter;
