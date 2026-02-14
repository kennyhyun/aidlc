import { spawn as nodeSpawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, access, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { generateToken, getLogPath, getSummaryPath } from './state-store.js';

export class BackgroundRunner {
  constructor(stateStore, spawnFn = nodeSpawn, options = {}) {
    this.store = stateStore;
    this.spawn = spawnFn;
    this.cleanupLog = options.cleanupLog || false;
    this.getLogPath = options.getLogPath || getLogPath;
    this.getSummaryPath = options.getSummaryPath || getSummaryPath;
  }

  async start(token, role, question) {
    const logPath = this.getLogPath(role, token);
    const summaryPath = this.getSummaryPath(role, token);
    await mkdir(dirname(logPath), { recursive: true });

    const systemPromptPath = join(dirname(logPath), '../../system-prompt.md');
    let systemPrompt = null;

    try {
      await access(systemPromptPath);
      systemPrompt = await readFile(systemPromptPath, 'utf-8');
    } catch {}

    const args = ['chat', '--no-interactive', '--trust-all-tools'];

    let input = question;
    if (systemPrompt) {
      input = `${systemPrompt}\n---\n${question}`;
    }

    args.push(input);

    const process = this.spawn('kiro-cli', args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.store.create(token, role, process.pid, logPath, summaryPath);

    const logStream = createWriteStream(logPath);
    logStream.write(`[REQUEST] Role: ${role}\n`);
    logStream.write(`[REQUEST] Token: ${token}\n`);
    logStream.write(`[REQUEST] Started at: ${new Date().toISOString()}\n`);
    if (systemPrompt) {
      logStream.write(`[REQUEST] System Prompt: ${systemPromptPath} (${systemPrompt.length} chars)\n`);
    }
    logStream.write(`Command: kiro-cli ${args.join(' ')}\n\n`);

    process.stdout.on('data', (data) => {
      logStream.write(data);
    });

    process.stderr.on('data', (data) => {
      logStream.write(data);
    });

    process.on('close', async (code) => {
      logStream.end();
      const status = code === 0 ? 'completed' : 'failed';
      this.store.update(token, { status });

      // Generate summary file
      try {
        await this.generateSummary(logPath, summaryPath);
      } catch {}

      if (this.cleanupLog) {
        const { unlink } = await import('fs/promises');
        try {
          await unlink(logPath);
        } catch {}
      }
    });

    process.unref();
  }

  async generateSummary(logPath, summaryPath) {
    const { readFile, writeFile } = await import('fs/promises');
    const logContent = await readFile(logPath, 'utf-8');

    // Find last "> " prompt (works with or without ANSI codes)
    const lines = logContent.split('\n');
    let lastPromptIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      // Match "> " at start of line (with optional ANSI codes and whitespace)
      if (/^(\x1B\[[0-9;?]*[a-zA-Z])*>\s/.test(lines[i])) {
        lastPromptIndex = i;
        break;
      }
    }

    // Extract from last prompt onwards
    let summary;
    if (lastPromptIndex !== -1) {
      summary = lines.slice(lastPromptIndex).join('\n');
    } else {
      summary = logContent;
    }

    // Remove ANSI codes from extracted summary
    summary = summary.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();

    await writeFile(summaryPath, summary, 'utf-8');
  }
}
