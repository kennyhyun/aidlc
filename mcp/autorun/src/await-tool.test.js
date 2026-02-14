import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AwaitTool } from './await-tool.js';
import { StateStore } from './state-store.js';

describe('Phase 5: await tool', () => {
  let awaitTool;
  let store;
  let mockReadFile;

  beforeEach(() => {
    store = new StateStore();
    mockReadFile = jest.fn();
    awaitTool = new AwaitTool(store, 55000, mockReadFile);
  });

  it('should throw error for invalid token', async () => {
    await expect(awaitTool.execute('invalid')).rejects.toThrow('Invalid token');
  });

  it('should return immediately for completed task', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'completed' });

    mockReadFile
      .mockResolvedValueOnce('line1\nline2\nline3\n')
      .mockResolvedValueOnce('# Summary\nTask completed');

    const result = await awaitTool.execute(token);

    expect(result.status).toBe('completed');
    expect(result.lineCount).toBe(3);
    expect(result.timeout).toBe(false);
    expect(result.summary).toBe('# Summary\nTask completed');
  });

  it('should return null summary if file does not exist', async () => {
    const token = 'a3f2c2';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'completed' });

    mockReadFile
      .mockResolvedValueOnce('line1\n')
      .mockRejectedValueOnce(new Error('ENOENT'));

    const result = await awaitTool.execute(token);

    expect(result.status).toBe('completed');
    expect(result.summary).toBe(null);
  });

  it('should return immediately for failed task', async () => {
    const token = 'b4e3d2';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'failed' });

    mockReadFile
      .mockResolvedValueOnce('error line\n')
      .mockResolvedValueOnce(null);

    const result = await awaitTool.execute(token);

    expect(result.status).toBe('failed');
    expect(result.lineCount).toBe(1);
    expect(result.timeout).toBe(false);
  });

  it('should poll until completion within timeout', async () => {
    const token = 'c5f4e3';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');

    mockReadFile
      .mockResolvedValueOnce('line1\nline2\n')
      .mockResolvedValueOnce('Done');

    setTimeout(() => {
      store.update(token, { status: 'completed' });
    }, 100);

    const result = await awaitTool.execute(token);

    expect(result.status).toBe('completed');
    expect(result.lineCount).toBe(2);
    expect(result.timeout).toBe(false);
    expect(result.summary).toBe('Done');
  });

  it('should timeout after 55 seconds', async () => {
    const token = 'd6g5f4';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');

    mockReadFile
      .mockResolvedValueOnce('line1\n')
      .mockResolvedValueOnce(null);

    const shortAwaitTool = new AwaitTool(store, 100, mockReadFile);

    const result = await shortAwaitTool.execute(token);

    expect(result.status).toBe('running');
    expect(result.lineCount).toBe(1);
    expect(result.timeout).toBe(true);
    expect(result.message).toBe('Task still running. Call await again to continue waiting.');
  });

  it('should count log file lines correctly', async () => {
    const token = 'e7h6g5';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'completed' });

    mockReadFile
      .mockResolvedValueOnce('line1\nline2\nline3\nline4\nline5\n')
      .mockResolvedValueOnce(null);

    const result = await awaitTool.execute(token);

    expect(result.lineCount).toBe(5);
  });

  it('should handle empty log file', async () => {
    const token = 'f8i7h6';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'completed' });

    mockReadFile
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(null);

    const result = await awaitTool.execute(token);

    expect(result.lineCount).toBe(0);
  });

  it('should handle log file without trailing newline', async () => {
    const token = 'g9j8i7';
    store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
    store.update(token, { status: 'completed' });

    mockReadFile
      .mockResolvedValueOnce('line1\nline2\nline3')
      .mockResolvedValueOnce(null);

    const result = await awaitTool.execute(token);

    expect(result.lineCount).toBe(3);
  });
});
