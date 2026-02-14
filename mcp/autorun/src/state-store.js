import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function generateToken() {
  return randomBytes(3).toString('hex');
}

export function getLogPath(role, token) {
  return join(__dirname, `../../../subagents/${role}/data/history/${token}.log`);
}

export function getSummaryPath(role, token) {
  return join(__dirname, `../../../subagents/${role}/data/history/${token}.summary.md`);
}

export class StateStore {
  constructor() {
    this.states = new Map();
  }

  create(token, role, pid, logPath, summaryPath) {
    if (this.states.has(token)) {
      throw new Error('Token already exists');
    }

    const state = {
      token,
      role,
      pid,
      logPath,
      summaryPath,
      status: 'running',
      createdAt: Date.now()
    };

    this.states.set(token, state);
    return state;
  }

  get(token) {
    return this.states.get(token) || null;
  }

  update(token, updates) {
    const state = this.states.get(token);
    if (state) {
      Object.assign(state, updates);
    }
    return state;
  }

  delete(token) {
    this.states.delete(token);
  }
}
