import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AskTool } from './ask-tool.js';
import { StateStore, generateToken } from './state-store.js';
import { BackgroundRunner } from './background-runner.js';

describe('Phase 3: ask tool - Explicit Async Mode', () => {
  let askTool;
  let store;
  let runner;
  let mockSpawn;

  beforeEach(() => {
    store = new StateStore();
    mockSpawn = jest.fn();
    runner = new BackgroundRunner(store, mockSpawn);
    askTool = new AskTool(store, runner);
  });

  it('should return token immediately when async=true', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'question', { async: true });

    expect(result.token).toBeDefined();
    expect(result.token).toMatch(/^[0-9a-f]{6}$/);
    expect(result.status).toBe('running');
  });

  it('should start background process when async=true', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'question', { async: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      'kiro-cli',
      expect.any(Array),
      expect.objectContaining({ detached: true })
    );

    const state = store.get(result.token);
    expect(state).toBeDefined();
    expect(state.status).toBe('running');
    expect(state.pid).toBe(1234);
  });

  it('should return correct response format', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'long task', { async: true });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('usage');
    
    expect(result.status).toBe('running');
    expect(result.summary).toContain('long task');
    expect(result.usage).toContain('await');
    expect(result.usage).toContain('halt');
  });

  it('should generate summary from question', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'analyze code quality', { async: true });

    expect(result.summary).toBe('analyze code quality started');
  });

  it('should truncate long questions in summary', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const longQuestion = 'a'.repeat(100);
    const result = await askTool.execute('test', longQuestion, { async: true });

    expect(result.summary.length).toBeLessThan(100);
    expect(result.summary).toContain('...');
  });
});

describe('Phase 4: ask tool - Hybrid Mode', () => {
  let askTool;
  let store;
  let runner;
  let mockSpawn;

  beforeEach(() => {
    store = new StateStore();
    mockSpawn = jest.fn();
    runner = new BackgroundRunner(store, mockSpawn);
    askTool = new AskTool(store, runner, 100);
  });

  it('should return result when completed within timeout', async () => {
    let closeCallback;
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
          setTimeout(() => callback(0), 50);
        }
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = askTool.execute('test', 'quick task');
    await new Promise(resolve => setTimeout(resolve, 60));
    
    const result = await resultPromise;

    expect(result.token).toBeUndefined();
    expect(result.status).toBe('completed');
    expect(result.logPath).toBeDefined();
  });

  it('should return token when exceeds timeout', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'long task');

    expect(result.token).toBeDefined();
    expect(result.token).toMatch(/^[0-9a-f]{6}$/);
    expect(result.status).toBe('running');
    expect(result.summary).toContain('long task');
  });

  it('should wait for completion when async=false', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 200);
        }
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'task', { async: false });

    expect(result.token).toBeUndefined();
    expect(result.status).toBe('completed');
  });

  it('should handle timeout boundary', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 100);
        }
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const result = await askTool.execute('test', 'boundary task');

    expect(result.token).toBeDefined();
    expect(result.status).toBe('running');
  });
});
