const TaskWatcher = require('../../src/services/task-watcher');
const { promises: fs } = require('fs');
const path = require('path');

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

describe('TaskWatcher', () => {
  let watcher;
  
  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
  });
  
  test('should create watcher with correct config', () => {
    watcher = new TaskWatcher('./config/tasks', 60000);
    
    expect(watcher.configDir).toBe('./config/tasks');
    expect(watcher.debounceMs).toBe(60000);
  });
  
  test('should register change handler', () => {
    watcher = new TaskWatcher('./config/tasks', 100);
    const handler = jest.fn();
    
    watcher.onChange(handler);
    
    expect(watcher.changeHandler).toBe(handler);
  });
});
