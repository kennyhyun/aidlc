const { App } = require('@slack/bolt');
const MessagingAdapter = require('./adapter');
const MessageThrottler = require('../../utils/message-throttler');
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
    const MAX_LENGTH = 3000; // Slack text block limit is ~3000 chars
    
    // Split message if too long
    if (text.length > MAX_LENGTH) {
      const chunks = this.splitMessage(text, MAX_LENGTH);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: chunk
            }
          }
        ];
        
        // Only add buttons to the last chunk
        if (isLast && buttons && buttons.length > 0) {
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
        
        try {
          await this.app.client.chat.postMessage({
            channel: channelId,
            blocks
          });
        } catch (error) {
          logger.error({ err: error, chunkLength: chunk.length }, 'Failed to send message chunk');
          // If still too long, truncate and retry
          if (error.data?.error === 'msg_too_long' || (error.message && error.message.includes('too long'))) {
            const truncated = chunk.substring(0, MAX_LENGTH - 100) + '\n\n... (메시지가 잘렸습니다)';
            await this.app.client.chat.postMessage({
              channel: channelId,
              text: truncated
            });
          } else {
            throw error;
          }
        }
      }
      return;
    }
    
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
    
    try {
      return await this.app.client.chat.postMessage({
        channel: channelId || this.defaultChannelId,
        text,
        blocks
      });
    } catch (error) {
      logger.error({ err: error, textLength: text.length }, 'Failed to send message');
      // If message too long, split and retry
      if (error.data?.error === 'msg_too_long' || (error.message && error.message.includes('too long'))) {
        logger.info('Message too long, splitting and retrying...');
        return await this.sendMessage(channelId, text, options);
      }
      throw error;
    }
  }
  
  async sendTyping(channelId) {
    // Slack doesn't have a typing indicator
    // Send a temporary message that can be updated later
    const result = await this.app.client.chat.postMessage({
      channel: channelId || this.defaultChannelId,
      text: '⏳ Processing...'
    });
    
    // Create throttler for this message
    const throttler = new MessageThrottler(
      async (text) => {
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text
            }
          }
        ];
        
        try {
          await this.app.client.chat.update({
            channel: result.channel,
            ts: result.ts,
            text,
            blocks
          });
        } catch (error) {
          logger.error({ err: error }, 'Failed to update message');
        }
      },
      {
        interval: 2000  // 2 seconds between updates
      }
    );
    
    // Return message info so it can be updated/deleted later
    return {
      channel: result.channel,
      ts: result.ts,
      update: async (text, options = {}) => {
        throttler.add(text);
      },
      delete: async () => {
        throttler.clear();
        return this.app.client.chat.delete({
          channel: result.channel,
          ts: result.ts
        });
      },
      flush: async () => {
        throttler.flush();
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
        channel_type: message.channel_type,
        subtype: message.subtype
      }, 'Message received');
      
      const channelId = message.channel;
      const text = message.text;
      const userId = message.user;
      
      // Ignore bot messages
      if (message.bot_id) {
        logger.debug('Ignoring bot message');
        return;
      }
      
      // Ignore messages without text (file uploads, etc.)
      if (!text) {
        logger.debug('Ignoring message without text');
        return;
      }
      
      // Ignore message subtypes (edits, deletes, etc.)
      if (message.subtype) {
        logger.debug(`Ignoring message with subtype: ${message.subtype}`);
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
