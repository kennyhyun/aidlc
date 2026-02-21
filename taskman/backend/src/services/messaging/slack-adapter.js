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
    console.log('[SlackAdapter] Starting Slack app...');
    console.log('[SlackAdapter] Bot Token:', this.botToken?.substring(0, 15) + '...');
    console.log('[SlackAdapter] App Token:', this.appToken?.substring(0, 15) + '...');
    console.log('[SlackAdapter] Default Channel:', this.defaultChannelId);
    
    this.app = new App({
      token: this.botToken,
      socketMode: true,
      appToken: this.appToken,
      logLevel: 'DEBUG'
    });
    
    await this.app.start();
    console.log('[SlackAdapter] ✅ Slack app started successfully');
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
    console.log('[SlackAdapter] Registering message handler...');
    
    this.app.message(async ({ message }) => {
      console.log('[SlackAdapter] 📨 Message received:', {
        channel: message.channel,
        user: message.user,
        text: message.text,
        bot_id: message.bot_id,
        channel_type: message.channel_type
      });
      
      const channelId = message.channel;
      const text = message.text;
      const userId = message.user;
      
      // Ignore bot messages
      if (message.bot_id) {
        console.log('[SlackAdapter] Ignoring bot message');
        return;
      }
      
      try {
        console.log('[SlackAdapter] Calling handler...');
        await handler(channelId, text, userId);
        console.log('[SlackAdapter] ✅ Handler completed');
      } catch (error) {
        console.error('[SlackAdapter] ❌ Handler error:', error);
      }
    });
    
    console.log('[SlackAdapter] ✅ Message handler registered');
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
