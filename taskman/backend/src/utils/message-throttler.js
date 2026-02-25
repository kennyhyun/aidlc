/**
 * Message Throttler
 * 
 * Batches and throttles messages to prevent rate limiting.
 * - First message is sent immediately for fast feedback
 * - Subsequent messages are throttled by interval
 */
class MessageThrottler {
  constructor(sendFn, options = {}) {
    this.sendFn = sendFn;
    this.interval = options.interval || 2000; // 2 seconds default
    this.pendingMessage = null;
    this.timer = null;
    this.lastSentTime = 0;
    this.isFirstMessage = true;
  }

  /**
   * Set the current message (replaces previous pending message)
   */
  add(message) {
    if (!message || !message.trim()) {
      return;
    }

    this.pendingMessage = message;

    // Send first message immediately
    if (this.isFirstMessage) {
      this.isFirstMessage = false;
      this.flush();
      return;
    }

    // Schedule a send if not already scheduled
    if (!this.timer) {
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;
      const delay = Math.max(0, this.interval - timeSinceLastSend);

      this.timer = setTimeout(() => {
        this.flush();
      }, delay);
    }
  }

  /**
   * Send the pending message immediately
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pendingMessage) {
      return;
    }

    const message = this.pendingMessage;
    this.pendingMessage = null;

    this.lastSentTime = Date.now();
    
    // Call the send function
    if (this.sendFn) {
      this.sendFn(message);
    }
  }

  /**
   * Clear pending message without sending
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingMessage = null;
  }
}

module.exports = MessageThrottler;
