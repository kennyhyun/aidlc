const TelegramAdapter = require('../../../src/services/messaging/telegram-adapter');

// Mock node-telegram-bot-api
jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({}),
    sendChatAction: jest.fn().mockResolvedValue({}),
    stopPolling: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({})
  }));
});

describe('TelegramAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = new TelegramAdapter('test-token', 'test-chat-id');
  });
  
  afterEach(async () => {
    if (adapter.bot) {
      await adapter.stop();
    }
  });
  
  test('should initialize with token and chatId', () => {
    expect(adapter.token).toBe('test-token');
    expect(adapter.defaultChatId).toBe('test-chat-id');
  });
  
  test('should start bot with polling', async () => {
    await adapter.start();
    expect(adapter.bot).toBeDefined();
  });
  
  test('should send message', async () => {
    await adapter.start();
    await adapter.sendMessage('chat1', 'Hello');
    expect(adapter.bot.sendMessage).toHaveBeenCalledWith('chat1', 'Hello', {});
  });
  
  test('should send message with buttons', async () => {
    await adapter.start();
    const buttons = [
      { text: 'Button 1', action: 'action1', data: 'data1' }
    ];
    await adapter.sendMessage('chat1', 'Hello', { buttons });
    
    expect(adapter.bot.sendMessage).toHaveBeenCalledWith(
      'chat1',
      'Hello',
      expect.objectContaining({
        reply_markup: expect.any(Object)
      })
    );
  });
  
  test('should use default chatId when not provided', async () => {
    await adapter.start();
    await adapter.sendMessage(null, 'Hello');
    expect(adapter.bot.sendMessage).toHaveBeenCalledWith('test-chat-id', 'Hello', {});
  });
  
  test('should send typing indicator', async () => {
    await adapter.start();
    await adapter.sendTyping('chat1');
    expect(adapter.bot.sendChatAction).toHaveBeenCalledWith('chat1', 'typing');
  });
  
  test('should register message handler', async () => {
    await adapter.start();
    const handler = jest.fn();
    await adapter.onMessage(handler);
    expect(adapter.bot.on).toHaveBeenCalledWith('message', expect.any(Function));
  });
  
  test('should register button click handler', async () => {
    await adapter.start();
    const handler = jest.fn();
    await adapter.onButtonClick(handler);
    expect(adapter.bot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
  });
  
  test('should stop bot', async () => {
    await adapter.start();
    await adapter.stop();
    expect(adapter.bot).toBeNull();
  });
});
