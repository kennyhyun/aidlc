class MessagingAdapter {
  async sendMessage(chatId, text, options = {}) {
    throw new Error('Not implemented');
  }
  
  async sendTyping(chatId) {
    throw new Error('Not implemented');
  }
  
  async onMessage(handler) {
    throw new Error('Not implemented');
  }
  
  async onButtonClick(handler) {
    throw new Error('Not implemented');
  }
  
  async start() {
    throw new Error('Not implemented');
  }
  
  async stop() {
    throw new Error('Not implemented');
  }
}

module.exports = MessagingAdapter;
