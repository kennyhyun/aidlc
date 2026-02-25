const MessageThrottler = require('../../src/utils/message-throttler');

describe('MessageThrottler', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create throttler with default options', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      expect(throttler.interval).toBe(2000);
      expect(throttler.pendingMessage).toBeNull();
    });

    it('should create throttler with custom options', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, {
        interval: 5000
      });

      expect(throttler.interval).toBe(5000);
    });
  });

  describe('add', () => {
    it('should send first message immediately', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      throttler.add('first message');

      expect(sendFn).toHaveBeenCalledWith('first message');
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent messages', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { interval: 2000 });

      // First message - immediate
      throttler.add('first message');
      expect(sendFn).toHaveBeenCalledTimes(1);

      // Second message - throttled
      throttler.add('second message');
      expect(sendFn).toHaveBeenCalledTimes(1); // Still 1

      jest.advanceTimersByTime(2000);
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenCalledWith('second message');
    });

    it('should ignore empty messages', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      throttler.add('');
      throttler.add('   ');
      throttler.add(null);

      expect(throttler.pendingMessage).toBeNull();
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('should replace previous pending message', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { interval: 2000 });

      throttler.add('first message');
      expect(sendFn).toHaveBeenCalledTimes(1);

      throttler.add('second message');
      throttler.add('third message');
      throttler.add('fourth message');

      jest.advanceTimersByTime(2000);
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenLastCalledWith('fourth message');
    });

    it('should not schedule multiple timers', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { interval: 2000 });

      throttler.add('first message');
      
      throttler.add('second message');
      const firstTimer = throttler.timer;
      
      throttler.add('third message');
      const secondTimer = throttler.timer;

      expect(firstTimer).toBe(secondTimer);
    });
  });

  describe('flush', () => {
    it('should send pending message', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      // First message is sent immediately
      throttler.add('message 1');
      expect(sendFn).toHaveBeenCalledTimes(1);

      // Second message is pending
      throttler.add('message 2');
      throttler.flush();

      expect(sendFn).toHaveBeenCalledWith('message 2');
      expect(throttler.pendingMessage).toBeNull();
    });

    it('should clear timer when flushing', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { interval: 2000 });

      // First message - immediate (no timer)
      throttler.add('message 1');
      expect(throttler.timer).toBeNull();

      // Second message - creates timer
      throttler.add('message 2');
      expect(throttler.timer).not.toBeNull();

      throttler.flush();
      expect(throttler.timer).toBeNull();
    });

    it('should do nothing if no pending message', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      throttler.flush();
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('should update lastSentTime', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      const before = throttler.lastSentTime;
      throttler.add('message');
      const after = throttler.lastSentTime;

      expect(after).toBeGreaterThan(before);
    });
  });

  describe('clear', () => {
    it('should clear pending message without sending', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn);

      // First message is sent immediately
      throttler.add('message 1');
      expect(sendFn).toHaveBeenCalledTimes(1);

      // Second message is pending
      throttler.add('message 2');
      throttler.clear();

      expect(throttler.pendingMessage).toBeNull();
      expect(sendFn).toHaveBeenCalledTimes(1); // Only first message
    });

    it('should clear timer', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { interval: 2000 });

      // First message - immediate
      throttler.add('message 1');
      
      // Second message - creates timer
      throttler.add('message 2');
      expect(throttler.timer).not.toBeNull();

      throttler.clear();
      expect(throttler.timer).toBeNull();
    });
  });

  describe('rate limiting behavior', () => {
    it('should send first message immediately then throttle', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { 
        interval: 2000
      });

      // First message - immediate
      throttler.add('msg 1');
      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith('msg 1');

      // Second message - throttled
      throttler.add('msg 2');
      expect(sendFn).toHaveBeenCalledTimes(1); // Still 1

      jest.advanceTimersByTime(2000);
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenCalledWith('msg 2');

      // Third message - throttled again
      throttler.add('msg 3');
      expect(sendFn).toHaveBeenCalledTimes(2); // Still 2

      jest.advanceTimersByTime(2000);
      expect(sendFn).toHaveBeenCalledTimes(3);
      expect(sendFn).toHaveBeenCalledWith('msg 3');
    });

    it('should handle rapid message updates efficiently', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { 
        interval: 1000
      });

      // First message - immediate
      throttler.add('line 1');
      expect(sendFn).toHaveBeenCalledTimes(1);

      // Add 14 more messages rapidly (simulating streaming)
      for (let i = 2; i <= 15; i++) {
        throttler.add(`accumulated message up to line ${i}`);
      }

      // Should still be 1 (all throttled)
      expect(sendFn).toHaveBeenCalledTimes(1);

      // After interval, should send the latest
      jest.advanceTimersByTime(1000);
      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenLastCalledWith('accumulated message up to line 15');
    });

    it('should handle flush before timer expires', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { 
        interval: 2000
      });

      // First message - immediate
      throttler.add('message 1');
      expect(sendFn).toHaveBeenCalledTimes(1);

      // Second message - throttled
      throttler.add('message 2');
      jest.advanceTimersByTime(500);
      
      // Flush before timer expires
      throttler.flush();
      expect(sendFn).toHaveBeenCalledWith('message 2');
      expect(sendFn).toHaveBeenCalledTimes(2);

      // Timer should not fire
      jest.advanceTimersByTime(1500);
      expect(sendFn).toHaveBeenCalledTimes(2);
    });

    it('should provide fast initial feedback', () => {
      const sendFn = jest.fn();
      const throttler = new MessageThrottler(sendFn, { 
        interval: 2000
      });

      const startTime = Date.now();
      
      // First message should be sent immediately (no delay)
      throttler.add('Processing started...');
      
      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(Date.now() - startTime).toBeLessThan(100); // Essentially immediate
    });
  });
});
