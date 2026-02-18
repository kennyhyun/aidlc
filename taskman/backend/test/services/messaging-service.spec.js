const MessagingService = require('../../src/services/messaging-service');
const TelegramAdapter = require('../../src/services/messaging/telegram-adapter');
const SlackAdapter = require('../../src/services/messaging/slack-adapter');

jest.mock('../../src/services/messaging/telegram-adapter');
jest.mock('../../src/services/messaging/slack-adapter');

describe('MessagingService', () => {
  let service;
  let mockAdapter;
  
  beforeEach(() => {
    mockAdapter = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
      sendTyping: jest.fn().mockResolvedValue(undefined),
      onMessage: jest.fn(),
      onButtonClick: jest.fn()
    };
    
    TelegramAdapter.mockImplementation(() => mockAdapter);
    SlackAdapter.mockImplementation(() => mockAdapter);
    
    service = new MessagingService();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initialize', () => {
    test('should initialize with Telegram adapter', async () => {
      const config = {
        platform: 'telegram',
        telegram: {
          token: 'test-token',
          chatId: '123456'
        }
      };
      
      await service.initialize(config);
      
      expect(TelegramAdapter).toHaveBeenCalledWith('test-token', '123456');
      expect(mockAdapter.start).toHaveBeenCalled();
      expect(mockAdapter.onMessage).toHaveBeenCalled();
      expect(mockAdapter.onButtonClick).toHaveBeenCalled();
    });
    
    test('should initialize with Slack adapter', async () => {
      const config = {
        platform: 'slack',
        slack: {
          botToken: 'xoxb-token',
          appToken: 'xapp-token',
          channelId: 'C123456'
        }
      };
      
      await service.initialize(config);
      
      expect(SlackAdapter).toHaveBeenCalledWith('xoxb-token', 'xapp-token', 'C123456');
      expect(mockAdapter.start).toHaveBeenCalled();
    });
    
    test('should throw error for unsupported platform', async () => {
      const config = {
        platform: 'discord',
        telegram: {}
      };
      
      await expect(service.initialize(config)).rejects.toThrow('Unsupported messaging platform: discord');
    });
    
    test('should default to telegram if platform not specified', async () => {
      const config = {
        telegram: {
          token: 'test-token',
          chatId: '123456'
        }
      };
      
      await service.initialize(config);
      
      expect(TelegramAdapter).toHaveBeenCalled();
    });
  });
  
  describe('handleMessage', () => {
    beforeEach(async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
    });
    
    test('should handle slash commands', async () => {
      await service.handleMessage('123', '/help', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('TaskMan Commands')
      );
    });
    
    test('should delegate natural language to custom handler', async () => {
      const customHandler = jest.fn();
      service.onMessage(customHandler);
      
      await service.handleMessage('123', 'Hello', 'user1');
      
      expect(mockAdapter.sendTyping).toHaveBeenCalledWith('123');
      expect(customHandler).toHaveBeenCalledWith('123', 'Hello', 'user1');
    });
    
    test('should show default message if no custom handler', async () => {
      await service.handleMessage('123', 'Hello', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('Unknown command')
      );
    });
  });
  
  describe('slash commands', () => {
    beforeEach(async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
    });
    
    test('/status should show service status', async () => {
      await service.handleCommand('123', '/status');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '✅ Service is running'
      );
    });
    
    test('/list should show tasks', async () => {
      await service.handleCommand('123', '/list');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '📋 No tasks configured'
      );
    });
    
    test('/run should require task-id', async () => {
      await service.handleCommand('123', '/run');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '❌ Usage: /run <task-id>'
      );
    });
    
    test('/run with task-id should start task', async () => {
      await service.handleCommand('123', '/run task-123');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '▶️ Task started: task-123'
      );
    });
    
    test('/cancel should require execution-id', async () => {
      await service.handleCommand('123', '/cancel');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '❌ Usage: /cancel <execution-id>'
      );
    });
    
    test('/cancel with execution-id should cancel task', async () => {
      await service.handleCommand('123', '/cancel 456');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '⏸️ Task cancelled: 456'
      );
    });
    
    test('/logs should require execution-id', async () => {
      await service.handleCommand('123', '/logs');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '❌ Usage: /logs <execution-id>'
      );
    });
    
    test('/logs with execution-id should show logs', async () => {
      await service.handleCommand('123', '/logs 456');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '📜 Logs for execution 456'
      );
    });
    
    test('/report should generate daily report', async () => {
      await service.handleCommand('123', '/report');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('Daily Report')
      );
    });
    
    test('/help should show help message', async () => {
      await service.handleCommand('123', '/help');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('TaskMan Commands')
      );
    });
    
    test('unknown command should show error', async () => {
      await service.handleCommand('123', '/unknown');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('Unknown command')
      );
    });
    
    test('should handle command errors', async () => {
      mockAdapter.sendMessage.mockRejectedValueOnce(new Error('Network error'));
      
      await service.handleCommand('123', '/status');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '❌ Error: Network error'
      );
    });
  });
  
  describe('handleButtonClick', () => {
    beforeEach(async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
    });
    
    test('should delegate to custom handler', async () => {
      const customHandler = jest.fn();
      service.onButtonClick(customHandler);
      
      await service.handleButtonClick('123', 'cancel', '456', 'user1');
      
      expect(customHandler).toHaveBeenCalledWith('123', 'cancel', '456', 'user1');
    });
    
    test('should handle cancel action', async () => {
      await service.handleButtonClick('123', 'cancel', '456', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '⏸️ Task cancelled: 456'
      );
    });
    
    test('should handle logs action', async () => {
      await service.handleButtonClick('123', 'logs', '456', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '📜 Logs for execution 456'
      );
    });
    
    test('should handle rerun action', async () => {
      await service.handleButtonClick('123', 'rerun', 'task-123', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        '▶️ Task started: task-123'
      );
    });
    
    test('should handle unknown action', async () => {
      await service.handleButtonClick('123', 'unknown', 'data', 'user1');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        '123',
        'Unknown action: unknown'
      );
    });
  });
  
  describe('notifications', () => {
    beforeEach(async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
    });
    
    test('should notify task started', async () => {
      await service.notifyTaskStarted('task-123', 'Build Backend', 456);
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        null,
        expect.stringContaining('Task started: Build Backend')
      );
    });
    
    test('should notify task completed with buttons', async () => {
      await service.notifyTaskCompleted('task-123', 'Build Backend', 456, 120);
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        null,
        expect.stringContaining('Task completed: Build Backend'),
        {
          buttons: [
            { text: '🔄 Rerun', action: 'rerun', data: 'task-123' },
            { text: '📜 Logs', action: 'logs', data: '456' }
          ]
        }
      );
    });
    
    test('should notify task failed with buttons', async () => {
      await service.notifyTaskFailed('task-123', 'Build Backend', 456, 'Timeout');
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        null,
        expect.stringContaining('Task failed: Build Backend'),
        {
          buttons: [
            { text: '🔄 Retry', action: 'rerun', data: 'task-123' },
            { text: '📜 Logs', action: 'logs', data: '456' }
          ]
        }
      );
    });
    
    test('should send daily report', async () => {
      await service.sendDailyReport();
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        null,
        expect.stringContaining('Daily Report')
      );
    });
  });
  
  describe('sendMessage', () => {
    beforeEach(async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
    });
    
    test('should send message through adapter', async () => {
      await service.sendMessage('123', 'Hello', { buttons: [] });
      
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith('123', 'Hello', { buttons: [] });
    });
  });
  
  describe('stop', () => {
    test('should stop adapter', async () => {
      await service.initialize({
        platform: 'telegram',
        telegram: { token: 'test', chatId: '123' }
      });
      
      await service.stop();
      
      expect(mockAdapter.stop).toHaveBeenCalled();
    });
    
    test('should handle stop when not initialized', async () => {
      await expect(service.stop()).resolves.not.toThrow();
    });
  });
});
