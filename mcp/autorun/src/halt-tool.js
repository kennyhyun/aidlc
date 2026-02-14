import { kill as processKill } from 'process';

export class HaltTool {
  constructor(stateStore, killFn = processKill) {
    this.store = stateStore;
    this.kill = killFn;
  }

  async execute(token) {
    const state = this.store.get(token);

    if (!state) {
      throw new Error('Invalid token');
    }

    if (state.status === 'completed') {
      throw new Error('Task already completed');
    }

    if (state.status === 'failed') {
      throw new Error('Task already failed');
    }

    try {
      this.kill(state.pid, 'SIGTERM');
    } catch (error) {
      try {
        this.kill(state.pid, 'SIGKILL');
      } catch (killError) {
        // Process already terminated
      }
    }

    this.store.update(token, { status: 'cancelled' });

    const result = {
      token,
      status: 'cancelled',
      message: 'Task cancelled successfully'
    };

    this.store.delete(token);

    return result;
  }
}
