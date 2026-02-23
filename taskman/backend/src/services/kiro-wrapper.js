const { spawn } = require('child_process');
const stripAnsi = require('strip-ansi');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

class KiroWrapper {
  constructor(workspaceService = null) {
    this.workspaceService = workspaceService;
  }

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
    
    // Determine workdir from workspace service
    let workdir = process.cwd();
    if (this.workspaceService) {
      workdir = this.workspaceService.getWorkdirForKiro();
      logger.debug(`kiro-wrapper/chat:: Using workspace: ${workdir}`);
    }
    
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
        workdir: workdir,
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
  
  parseContextInfo(output) {
    const tokenMatch = output.match(/Token usage:\s*(\d+)\s*\/\s*(\d+)/i);
    if (tokenMatch) {
      const used = parseInt(tokenMatch[1]);
      const total = parseInt(tokenMatch[2]);
      const percentage = Math.round((used / total) * 100);
      return { used, total, percentage };
    }
    return null;
  }
  
  formatResponse(cleanOutput, contextInfo, workdir) {
    let response = cleanOutput;
    
    // 워크스페이스 정보 추가
    response += `\n\n[워크스페이스: ${workdir}]`;
    
    // 컨텍스트 정보 추가
    if (contextInfo) {
      response += `\n[컨텍스트: ${contextInfo.percentage}% (${contextInfo.used}/${contextInfo.total} 토큰)]`;
    }
    
    return response;
  }
  
  async clearSession(workdir) {
    const sessionPath = path.join(workdir, '.kiro', 'sessions');
    
    if (!fs.existsSync(sessionPath)) {
      logger.debug(`Session path does not exist: ${sessionPath}`);
      return;
    }
    
    try {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        const filePath = path.join(sessionPath, file);
        fs.unlinkSync(filePath);
        logger.debug(`Deleted session file: ${filePath}`);
      }
      logger.info(`Cleared session for workdir: ${workdir}`);
    } catch (error) {
      logger.error(`Failed to clear session: ${error.message}`);
    }
  }
}

module.exports = KiroWrapper;
