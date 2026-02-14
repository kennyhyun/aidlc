import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { HaltTool } from './halt-tool.js';
import { StateStore } from './state-store.js';

describe('Phase 6: halt tool', () => {
  let haltTool;
  let store;
  let mockKill;

  beforeEach(() => {
    store = new StateStore();
    mockKill = jest.fn();
    haltTool = new HaltTool(store, mockKill);
  });

  it('should terminate process with SIGTERM', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');

    await haltTool.execute(token);

    expect(mockKill).toHaveBeenCalledWith(1234, 'SIGTERM');
  });

  it('should update status to cancelled before deletion', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');

    const originalUpdate = store.update.bind(store);
    let capturedStatus;
    store.update = jest.fn((token, updates) => {
      capturedStatus = updates.status;
      return originalUpdate(token, updates);
    });

    await haltTool.execute(token);

    expect(capturedStatus).toBe('cancelled');
  });

  it('should send SIGKILL if SIGTERM fails', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');

    mockKill.mockImplementation((pid, signal) => {
      if (signal === 'SIGTERM') {
        throw new Error('Process not found');
      }
    });

    await haltTool.execute(token);

    expect(mockKill).toHaveBeenCalledWith(1234, 'SIGTERM');
    expect(mockKill).toHaveBeenCalledWith(1234, 'SIGKILL');
  });

  it('should throw error for invalid token', async () => {
    await expect(haltTool.execute('invalid')).rejects.toThrow('Invalid token');
  });

  it('should throw error for already completed task', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');
    store.update(token, { status: 'completed' });

    await expect(haltTool.execute(token)).rejects.toThrow('Task already completed');
  });

  it('should throw error for already failed task', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');
    store.update(token, { status: 'failed' });

    await expect(haltTool.execute(token)).rejects.toThrow('Task already failed');
  });

  it('should delete state from memory after halt', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');

    await haltTool.execute(token);

    expect(store.get(token)).toBeNull();
  });

  it('should return halt confirmation', async () => {
    const token = 'a3f2c1';
    store.create(token, 'test', 1234, '/path/to/log');

    const result = await haltTool.execute(token);

    expect(result).toEqual({
      token: 'a3f2c1',
      status: 'cancelled',
      message: 'Task cancelled successfully'
    });
  });
});
