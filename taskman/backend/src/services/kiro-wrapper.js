const { spawn } = require('child_process');
const stripAnsi = require('strip-ansi').default || require('strip-ansi');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

class KiroWrapper {
  async executeCommand({ command, workdir, timeout = 1800 }) {
    logger.debug(`kiro-wrapper/executeCommand:: Running command: ${command}`);
    
    return new Promise((resolve, reject) => {
      const childProcess = spawn('sh', ['-c', command], {
        cwd: workdir,
        env: { ...process.env },
        timeout: timeout * 1000
      });
      
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      childProcess.on('close', (code) => {
        logger.debug(`kiro-wrapper/executeCommand:: Command exited with code ${code}`);
        resolve({ code, stdout, stderr });
      });
      
      childProcess.on('error', (error) => {
        logger.error(`kiro-wrapper/executeCommand:: Command error: ${error?.message}`);
        reject(error);
      });
    });
  }
  
  async chat(message, context = {}) {
    logger.debug(`kiro-wrapper/chat:: Received message: ${message}`);
    logger.debug(`kiro-wrapper/chat:: Context: ${JSON.stringify(context, null, 2)}`);
    
    // Build context string for Kiro
    const contextStr = JSON.stringify(context, null, 2);
    
    // Create a prompt with context
    const fullPrompt = `You are a task management assistant. Help the user with their request based on the following context.

Context:
${contextStr}

User message: ${message}

Instructions:
- If the user clearly wants to execute a task (e.g., "run X", "execute X", "X 실행해줘", "X 돌려줘"), respond with ONLY this JSON format:
  {"action": "execute", "task_id": "task-id-here"}
  
- If the user asks about task status, list, or information, provide a helpful response in Korean.

- If the user's intent is unclear, ask for clarification in Korean.

Respond in Korean for explanations, but use the JSON format for execution requests.`;
    
    // Escape quotes in prompt
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
    
    try {
      logger.debug('kiro-wrapper/chat:: Calling kiro-cli...');
      
      const result = await this.executeCommand({
        command: `kiro-cli chat --no-interactive --trust-all-tools '${escapedPrompt}'`,
        workdir: process.cwd(),
        timeout: 60
      });
      
      if (result.code === 0) {
        const cleanOutput = stripAnsi(result.stdout.trim());
        logger.debug(`kiro-wrapper/chat:: Response: ${cleanOutput}`);
        return cleanOutput;
      } else {
        logger.error(`kiro-wrapper/chat:: Kiro CLI failed with stderr: ${result.stderr}`);
        throw new Error(result.stderr || 'Kiro CLI failed');
      }
    } catch (error) {
      logger.error(`kiro-wrapper/chat:: Error: ${error?.message}`);
      throw new Error(`Kiro CLI error: ${error?.message}`);
    }
  }
}

module.exports = KiroWrapper;
