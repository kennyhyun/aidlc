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

  // Helper method to split long messages
  splitMessage(text, maxLength) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at newline
      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        // No good newline, try space
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength / 2) {
        // No good split point, hard cut
        splitIndex = maxLength;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }
}

module.exports = MessagingAdapter;
