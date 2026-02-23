const SlackAdapter = require('../../../src/services/messaging/slack-adapter');

// Mock @slack/bolt
jest.mock('@slack/bolt');

describe('SlackAdapter', () => {
  let adapter;
  let mockApp;
  
  beforeEach(() => {
    // Create mock app
    mockApp = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      client: {
        chat: {
          postMessage: jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' })
        }
      },
      message: jest.fn(),
      action: jest.fn()
    };
    
    // Mock App constructor
    const { App } = require('@slack/bolt');
    App.mockImplementation(() => mockApp);
    
    adapter = new SlackAdapter('xoxb-test-token', 'xapp-test-token', 'C1234567890');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('start', () => {
    test('should initialize Slack app with Socket Mode', async () => {
      await adapter.start();
      
      const { App } = require('@slack/bolt');
      expect(App).toHaveBeenCalledWith({
        token: 'xoxb-test-token',
        socketMode: true,
        appToken: 'xapp-test-token',
        logLevel: 'ERROR'
      });
      expect(mockApp.start).toHaveBeenCalled();
    });
  });
  
  describe('stop', () => {
    test('should stop Slack app', async () => {
      await adapter.start();
      await adapter.stop();
      
      expect(mockApp.stop).toHaveBeenCalled();
      expect(adapter.app).toBeNull();
    });
    
    test('should handle stop when app is not started', async () => {
      await expect(adapter.stop()).resolves.not.toThrow();
    });
  });
  
  describe('sendMessage', () => {
    beforeEach(async () => {
      await adapter.start();
    });
    
    test('should send text message to default channel', async () => {
      await adapter.sendMessage(null, 'Hello Slack');
      
      expect(mockApp.client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'Hello Slack',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Hello Slack'
            }
          }
        ]
      });
    });
    
    test('should send message to specific channel', async () => {
      await adapter.sendMessage('C9876543210', 'Hello Channel');
      
      expect(mockApp.client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C9876543210',
        text: 'Hello Channel',
        blocks: expect.any(Array)
      });
    });
    
    test('should send message with buttons', async () => {
      const buttons = [
        { text: 'Cancel', action: 'cancel', data: '123' },
        { text: 'Logs', action: 'logs', data: '123' }
      ];
      
      await adapter.sendMessage(null, 'Task started', { buttons });
      
      expect(mockApp.client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: 'Task started',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Task started'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Cancel'
                },
                action_id: 'cancel:123'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Logs'
                },
                action_id: 'logs:123'
              }
            ]
          }
        ]
      });
    });
  });
  
  describe('sendTyping', () => {
    beforeEach(async () => {
      await adapter.start();
    });
    
    test('should send processing message', async () => {
      await adapter.sendTyping('C1234567890');
      
      expect(mockApp.client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1234567890',
        text: '⏳ Processing...'
      });
    });
  });
  
  describe('onMessage', () => {
    beforeEach(async () => {
      await adapter.start();
    });
    
    test('should register message handler', async () => {
      const handler = jest.fn();
      await adapter.onMessage(handler);
      
      expect(mockApp.message).toHaveBeenCalled();
      
      // Simulate message event
      const messageCallback = mockApp.message.mock.calls[0][0];
      await messageCallback({
        message: {
          channel: 'C1234567890',
          text: 'Hello',
          user: 'U1234567890'
        }
      });
      
      expect(handler).toHaveBeenCalledWith('C1234567890', 'Hello', 'U1234567890');
    });
    
    test('should ignore bot messages', async () => {
      const handler = jest.fn();
      await adapter.onMessage(handler);
      
      const messageCallback = mockApp.message.mock.calls[0][0];
      await messageCallback({
        message: {
          channel: 'C1234567890',
          text: 'Bot message',
          user: 'U1234567890',
          bot_id: 'B1234567890'
        }
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    test('should handle errors in message handler', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      await adapter.onMessage(handler);
      
      const messageCallback = mockApp.message.mock.calls[0][0];
      
      await expect(messageCallback({
        message: {
          channel: 'C1234567890',
          text: 'Hello',
          user: 'U1234567890'
        }
      })).resolves.not.toThrow();
    });
  });
  
  describe('onButtonClick', () => {
    beforeEach(async () => {
      await adapter.start();
    });
    
    test('should register button click handler', async () => {
      const handler = jest.fn();
      await adapter.onButtonClick(handler);
      
      expect(mockApp.action).toHaveBeenCalledWith(/.*/, expect.any(Function));
      
      // Simulate button click
      const actionCallback = mockApp.action.mock.calls[0][1];
      const ack = jest.fn();
      
      await actionCallback({
        action: {
          action_id: 'cancel:123'
        },
        ack,
        body: {
          channel: {
            id: 'C1234567890'
          },
          user: {
            id: 'U1234567890'
          }
        }
      });
      
      expect(ack).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith('C1234567890', 'cancel', '123', 'U1234567890');
    });
    
    test('should handle errors in button click handler', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      await adapter.onButtonClick(handler);
      
      const actionCallback = mockApp.action.mock.calls[0][1];
      const ack = jest.fn();
      
      await expect(actionCallback({
        action: {
          action_id: 'cancel:123'
        },
        ack,
        body: {
          channel: {
            id: 'C1234567890'
          },
          user: {
            id: 'U1234567890'
          }
        }
      })).resolves.not.toThrow();
      
      expect(ack).toHaveBeenCalled();
    });
  });
});
