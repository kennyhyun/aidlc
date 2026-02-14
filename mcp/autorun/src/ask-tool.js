import { generateToken } from './state-store.js';

export class AskTool {
  constructor(stateStore, backgroundRunner, timeout = 10000) {
    this.store = stateStore;
    this.runner = backgroundRunner;
    this.timeout = timeout;
  }

  async execute(agentName, question, options = {}) {
    const { async } = options;

    if (async === true) {
      return this.executeAsync(agentName, question);
    }

    if (async === false) {
      return this.executeSync(agentName, question);
    }

    return this.executeHybrid(agentName, question);
  }

  async executeAsync(agentName, question) {
    const token = generateToken();
    
    await this.runner.start(token, agentName, question);

    const summary = this.generateSummary(question);
    
    return {
      token,
      status: 'running',
      summary,
      usage: 'Use await(token) to get the response, halt(token) to cancel'
    };
  }

  async executeSync(agentName, question) {
    const token = generateToken();
    await this.runner.start(token, agentName, question);

    return this.waitForCompletion(token);
  }

  async executeHybrid(agentName, question) {
    const token = generateToken();
    await this.runner.start(token, agentName, question);

    const completed = await this.waitWithTimeout(token, this.timeout);

    if (completed) {
      const state = this.store.get(token);
      this.store.delete(token);
      return {
        status: state.status,
        logPath: state.logPath
      };
    }

    const summary = this.generateSummary(question);
    return {
      token,
      status: 'running',
      summary,
      usage: 'Use await(token) to get the response, halt(token) to cancel'
    };
  }

  async waitForCompletion(token) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const state = this.store.get(token);
        if (state && state.status !== 'running') {
          clearInterval(check);
          this.store.delete(token);
          resolve({
            status: state.status,
            logPath: state.logPath
          });
        }
      }, 100);
    });
  }

  async waitWithTimeout(token, timeout) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearInterval(check);
        resolve(false);
      }, timeout);

      const check = setInterval(() => {
        const state = this.store.get(token);
        if (state && state.status !== 'running') {
          clearTimeout(timer);
          clearInterval(check);
          resolve(true);
        }
      }, 10);
    });
  }

  generateSummary(question) {
    const maxLength = 50;
    if (question.length <= maxLength) {
      return `${question} started`;
    }
    return `${question.substring(0, maxLength)}... started`;
  }
}
