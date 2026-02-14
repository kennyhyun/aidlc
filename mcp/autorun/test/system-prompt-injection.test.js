import { BackgroundRunner } from '../src/background-runner.js';
import { StateStore } from '../src/state-store.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { EventEmitter } from 'events';

describe('System Prompt Injection', () => {
  let stateStore;
  let mockSpawn;
  let spawnedProcesses;
  const testDir = join(process.cwd(), 'test-temp-system-prompt');

  beforeEach(async () => {
    stateStore = new StateStore();
    spawnedProcesses = [];

    mockSpawn = (cmd, args, options) => {
      console.debug('[MOCK SPAWN] cmd:', cmd);
      console.debug('[MOCK SPAWN] args:', JSON.stringify(args, null, 2));
      console.debug('[MOCK SPAWN] options:', JSON.stringify(options, null, 2));

      const mockProcess = new EventEmitter();
      mockProcess.pid = Math.floor(Math.random() * 10000);
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.unref = () => {};

      spawnedProcesses.push({ cmd, args, options, process: mockProcess });

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Response from agent\n'));
        mockProcess.emit('close', 0);
      }, 10);

      return mockProcess;
    };

    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Keep logs for inspection
    // await rm(testDir, { recursive: true, force: true });
  });

  it('should include system-prompt.md content when file exists', async () => {
    const getLogPath = (role, token) => join(testDir, 'with-prompt/data/history', `${token}.log`);
    const getSummaryPath = (role, token) => join(testDir, 'with-prompt/data/history', `${token}.summary.md`);

    // Create system-prompt.md at correct relative location
    const systemPromptPath = join(testDir, 'with-prompt', 'system-prompt.md');
    const systemPromptContent = '# Test Agent\n\nYou are a test specialist.';
    await mkdir(join(testDir, 'with-prompt'), { recursive: true });
    await writeFile(systemPromptPath, systemPromptContent);

    const runner = new BackgroundRunner(stateStore, mockSpawn, {
      cleanupLog: false,
      getLogPath,
      getSummaryPath
    });

    const token = 'test01';
    const role = 'test';
    const question = 'Write a test';

    await runner.start(token, role, question);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(spawnedProcesses.length).toBe(1);
    const spawnCall = spawnedProcesses[0];

    expect(spawnCall.args).toContain(systemPromptContent);
    expect(spawnCall.args).toContain(question);
    expect(spawnCall.args).toContain('\n---\n');
    expect(spawnCall.args.length).toBe(4); // chat, --no-interactive, --trust-all-tools, input
  });

  it('should only send question when system-prompt.md does not exist', async () => {
    const getLogPath = (role, token) => join(testDir, 'no-prompt', `${token}.log`);
    const getSummaryPath = (role, token) => join(testDir, 'no-prompt', `${token}.summary.md`);

    const runner = new BackgroundRunner(stateStore, mockSpawn, {
      cleanupLog: false,
      getLogPath,
      getSummaryPath
    });

    const token = 'test02';
    const role = 'test';
    const question = 'Write a test';

    await runner.start(token, role, question);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(spawnedProcesses.length).toBe(1);
    const spawnCall = spawnedProcesses[0];

    expect(spawnCall.args).toContain(question);
    expect(spawnCall.args.length).toBe(4); // chat, --no-interactive, --trust-all-tools, question
  });

  it('should handle file read errors gracefully', async () => {
    const getLogPath = (role, token) => join(testDir, 'error', `${token}.log`);
    const getSummaryPath = (role, token) => join(testDir, 'error', `${token}.summary.md`);

    const runner = new BackgroundRunner(stateStore, mockSpawn, {
      cleanupLog: false,
      getLogPath,
      getSummaryPath
    });

    const token = 'test03';
    const role = 'test';
    const question = 'Write a test';

    await expect(runner.start(token, role, question)).resolves.not.toThrow();
  });

  it('should handle multi-line system prompt and question', async () => {
    const getLogPath = (role, token) => join(testDir, 'multiline/data/history', `${token}.log`);
    const getSummaryPath = (role, token) => join(testDir, 'multiline/data/history', `${token}.summary.md`);

    const systemPromptPath = join(testDir, 'multiline', 'system-prompt.md');
    const systemPromptContent = `# Test Agent

You are a test specialist.

## Guidelines
- Write comprehensive tests
- Follow TDD approach`;
    await mkdir(join(testDir, 'multiline'), { recursive: true });
    await writeFile(systemPromptPath, systemPromptContent);

    const runner = new BackgroundRunner(stateStore, mockSpawn, {
      cleanupLog: false,
      getLogPath,
      getSummaryPath
    });

    const token = 'test04';
    const role = 'test';
    const question = `Please help me with:
1. Write unit tests
2. Add integration tests`;

    await runner.start(token, role, question);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(spawnedProcesses.length).toBe(1);
    const spawnCall = spawnedProcesses[0];

    const combinedInput = `${systemPromptContent}\n---\n${question}`;
    expect(spawnCall.args).toContain(combinedInput);
    expect(spawnCall.args[3]).toContain('# Test Agent');
    expect(spawnCall.args[3]).toContain('Write unit tests');
  });
});
