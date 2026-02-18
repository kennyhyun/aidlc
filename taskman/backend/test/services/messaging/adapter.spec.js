const MessagingAdapter = require('../../../src/services/messaging/adapter');

describe('MessagingAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = new MessagingAdapter();
  });
  
  test('should throw error for unimplemented sendMessage', async () => {
    await expect(adapter.sendMessage('chat1', 'test')).rejects.toThrow('Not implemented');
  });
  
  test('should throw error for unimplemented sendTyping', async () => {
    await expect(adapter.sendTyping('chat1')).rejects.toThrow('Not implemented');
  });
  
  test('should throw error for unimplemented onMessage', async () => {
    await expect(adapter.onMessage(() => {})).rejects.toThrow('Not implemented');
  });
  
  test('should throw error for unimplemented onButtonClick', async () => {
    await expect(adapter.onButtonClick(() => {})).rejects.toThrow('Not implemented');
  });
  
  test('should throw error for unimplemented start', async () => {
    await expect(adapter.start()).rejects.toThrow('Not implemented');
  });
  
  test('should throw error for unimplemented stop', async () => {
    await expect(adapter.stop()).rejects.toThrow('Not implemented');
  });
});
