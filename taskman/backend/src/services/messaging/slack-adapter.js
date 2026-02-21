const { App } = require('@slack/bolt');
const MessagingAdapter = require('./adapter');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class SlackAdapter extends MessagingAdapter {
  constructor(botToken, appToken, channelId) {
    super();
    this.botToken = botToken;
    this.appToken = appToken;
    this.defaultChannelId = channelId;
    this.app = null;
  }
  
  async start() {
    logger.debug('Starting Slack app...');
    logger.debug(`Bot Token: ${this.botToken?.substring(0, 15)}...`);
    logger.debug(`App Token: ${this.appToken?.substring(0, 15)}...`);
    logger.debug(`Default Channel: ${this.defaultChannelId}`);
    
    this.app = new App({
      token: this.botToken,
      socketMode: true,
      appToken: this.appToken,
      logLevel: process.env.LOG_LEVEL === 'debug' ? 'DEBUG' : 'ERROR'
    });
    
    await this.app.start();
    logger.info('Slack app started successfully');
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
    // Slack doesn't have a typing indicator
    // Send a temporary message that can be updated later
    const result = await this.app.client.chat.postMessage({
      channel: channelId || this.defaultChannelId,
      text: '⏳ Processing...'
    });
    
    // Return message info so it can be updated/deleted later
    return {
      channel: result.channel,
      ts: result.ts,
      update: async (text, options = {}) => {
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
        
        return this.app.client.chat.update({
          channel: result.channel,
          ts: result.ts,
          text,
          blocks
        });
      },
      delete: async () => {
        return this.app.client.chat.delete({
          channel: result.channel,
          ts: result.ts
        });
      }
    };
  }
  
  async onMessage(handler) {
    logger.debug('Registering message handler...');
    
    this.app.message(async ({ message }) => {
      logger.debug({
        channel: message.channel,
        user: message.user,
        text: message.text,
        bot_id: message.bot_id,
        channel_type: message.channel_type
      }, 'Message received');
      
      const channelId = message.channel;
      const text = message.text;
      const userId = message.user;
      
      // Ignore bot messages
      if (message.bot_id) {
        logger.debug('Ignoring bot message');
        return;
      }
      
      try {
        logger.debug('Calling message handler...');
        await handler(channelId, text, userId);
        logger.debug('Message handler completed');
      } catch (error) {
        logger.error({ err: error }, 'Message handler error');
      }
    });
    
    logger.debug('Message handler registered');
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
        // Error handling
      }
    });
  }
}

module.exports = SlackAdapter;
