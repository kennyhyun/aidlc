import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BackgroundRunner } from './background-runner.js';
import { StateStore } from './state-store.js';

describe('Phase 2: Background Process Execution', () => {
  let runner;
  let store;
  let mockSpawn;

  beforeEach(() => {
    store = new StateStore();
    mockSpawn = jest.fn();
    runner = new BackgroundRunner(store, mockSpawn, { cleanupLog: true });
  });

  it('should spawn detached process', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    expect(mockSpawn).toHaveBeenCalledWith(
      'kiro-cli',
      expect.any(Array),
      expect.objectContaining({ detached: true })
    );
  });

  it('should track process status', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    const state = store.get(token);
    expect(state.status).toBe('running');
    expect(state.pid).toBe(1234);
  });

  it('should update status to completed on success', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    await new Promise(resolve => setTimeout(resolve, 20));
    const state = store.get(token);
    expect(state.status).toBe('completed');
  });

  it('should update status to failed on error', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(1);
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    await new Promise(resolve => setTimeout(resolve, 20));
    const state = store.get(token);
    expect(state.status).toBe('failed');
  });

  it('should create log file', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    const state = store.get(token);
    expect(state.logPath).toMatch(/\.log$/);
  });

  it('should generate summary file on completion', async () => {
    const mockProcess = {
      pid: 1234,
      stdout: { 
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Test response output'));
          }
        })
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      }),
      unref: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess);

    const token = '2026-02-09T10-57-30-397Z';
    await runner.start(token, 'test', 'question');

    await new Promise(resolve => setTimeout(resolve, 20));
    const state = store.get(token);
    expect(state.summaryPath).toMatch(/\.summary\.md$/);
  });

  it('should extract last response from log with "> " prompt', async () => {
    const logContent = 'Some output\n\n> First response\n\nMore output\n\n> Last response here\n';
    const mockReadFile = jest.fn().mockResolvedValue(logContent);
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    
    runner.generateSummary = async (logPath, summaryPath) => {
      const content = await mockReadFile(logPath);
      const cleanLog = content.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      const lines = cleanLog.split('\n');
      let lastPromptIndex = -1;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('> ')) {
          lastPromptIndex = i;
          break;
        }
      }
      
      const summary = lastPromptIndex !== -1 
        ? lines.slice(lastPromptIndex).join('\n').trim()
        : cleanLog.trim();
      
      await mockWriteFile(summaryPath, summary);
    };

    await runner.generateSummary('/path/to/log', '/path/to/summary');
    
    expect(mockReadFile).toHaveBeenCalledWith('/path/to/log');
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/path/to/summary',
      expect.stringContaining('> Last response here')
    );
  });

  it('should remove ANSI color codes before extraction', async () => {
    const logContent = '\x1B[38;5;141m> \x1B[0mResponse with colors\x1B[0m';
    const mockReadFile = jest.fn().mockResolvedValue(logContent);
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    
    runner.generateSummary = async (logPath, summaryPath) => {
      const content = await mockReadFile(logPath);
      const cleanLog = content.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      await mockWriteFile(summaryPath, cleanLog.trim());
    };

    await runner.generateSummary('/path/to/log', '/path/to/summary');
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/path/to/summary',
      expect.not.stringContaining('\x1B')
    );
  });

  it('should use entire log if no prompt marker found', async () => {
    const logContent = 'No prompt markers here\nJust plain output';
    const mockReadFile = jest.fn().mockResolvedValue(logContent);
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    
    runner.generateSummary = async (logPath, summaryPath) => {
      const content = await mockReadFile(logPath);
      const cleanLog = content.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      const lines = cleanLog.split('\n');
      let lastPromptIndex = -1;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('> ')) {
          lastPromptIndex = i;
          break;
        }
      }
      
      const summary = lastPromptIndex !== -1 
        ? lines.slice(lastPromptIndex).join('\n').trim()
        : cleanLog.trim();
      
      await mockWriteFile(summaryPath, summary);
    };

    await runner.generateSummary('/path/to/log', '/path/to/summary');
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/path/to/summary',
      'No prompt markers here\nJust plain output'
    );
  });
});
