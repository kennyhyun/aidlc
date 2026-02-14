import { describe, it, expect, beforeEach } from '@jest/globals';
import { StateStore, generateToken, getLogPath, getSummaryPath } from './state-store.js';

describe('Phase 1: State Management', () => {
  describe('generateToken', () => {
    it('should generate 6-char hex token', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]{6}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getLogPath', () => {
    it('should generate correct log path', () => {
      const token = 'a3f2c1';
      const role = 'test';
      const path = getLogPath(role, token);
      expect(path).toMatch(/aidlc\/subagents\/test\/data\/history\/a3f2c1\.log$/);
    });
  });

  describe('getSummaryPath', () => {
    it('should generate correct summary path', () => {
      const token = 'a3f2c1';
      const role = 'test';
      const path = getSummaryPath(role, token);
      expect(path).toMatch(/aidlc\/subagents\/test\/data\/history\/a3f2c1\.summary\.md$/);
    });
  });

  describe('StateStore', () => {
    let store;

    beforeEach(() => {
      store = new StateStore();
    });

    it('should create new state', () => {
      const token = '2026-02-09T10-57-30-397Z';
      const state = store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
      
      expect(state.token).toBe(token);
      expect(state.role).toBe('test');
      expect(state.pid).toBe(1234);
      expect(state.logPath).toBe('/path/to/log');
      expect(state.summaryPath).toBe('/path/to/summary');
      expect(state.status).toBe('running');
    });

    it('should get existing state', () => {
      const token = '2026-02-09T10-57-30-397Z';
      store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
      
      const state = store.get(token);
      expect(state.token).toBe(token);
    });

    it('should return null for non-existent token', () => {
      const state = store.get('non-existent');
      expect(state).toBeNull();
    });

    it('should update state', () => {
      const token = '2026-02-09T10-57-30-397Z';
      store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
      
      store.update(token, { status: 'completed' });
      const state = store.get(token);
      expect(state.status).toBe('completed');
    });

    it('should delete state', () => {
      const token = '2026-02-09T10-57-30-397Z';
      store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
      
      store.delete(token);
      expect(store.get(token)).toBeNull();
    });

    it('should prevent duplicate token creation', () => {
      const token = '2026-02-09T10-57-30-397Z';
      store.create(token, 'test', 1234, '/path/to/log', '/path/to/summary');
      
      expect(() => {
        store.create(token, 'test', 5678, '/other/path');
      }).toThrow('Token already exists');
    });
  });
});
