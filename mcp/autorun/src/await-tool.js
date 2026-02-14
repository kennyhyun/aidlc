import { readFile } from 'fs/promises';

export class AwaitTool {
  constructor(stateStore, timeout = 55000, readFileFn = readFile) {
    this.store = stateStore;
    this.timeout = timeout;
    this.readFile = readFileFn;
  }

  async execute(token) {
    const state = this.store.get(token);
    if (!state) {
      throw new Error('Invalid token');
    }

    if (state.status !== 'running') {
      const lineCount = await this.countLines(state.logPath);
      const summary = await this.readSummary(state.summaryPath);
      return {
        status: state.status,
        lineCount,
        timeout: false,
        summary
      };
    }

    const completed = await this.pollUntilComplete(token);

    const updatedState = this.store.get(token);
    const lineCount = await this.countLines(updatedState.logPath);
    const summary = await this.readSummary(updatedState.summaryPath);

    return {
      status: updatedState.status,
      lineCount,
      timeout: !completed,
      summary,
      message: !completed ? 'Task still running. Call await again to continue waiting.' : undefined
    };
  }

  async pollUntilComplete(token) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearInterval(check);
        resolve(false);
      }, this.timeout);

      const check = setInterval(() => {
        const state = this.store.get(token);
        if (state && state.status !== 'running') {
          clearTimeout(timer);
          clearInterval(check);
          resolve(true);
        }
      }, 100);
    });
  }

  async countLines(logPath) {
    try {
      const content = await this.readFile(logPath, 'utf-8');
      if (content === '') return 0;
      
      const lines = content.split('\n');
      return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    } catch {
      return 0;
    }
  }

  async readSummary(summaryPath) {
    try {
      return await this.readFile(summaryPath, 'utf-8');
    } catch {
      return null;
    }
  }
}
