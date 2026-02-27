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

function getLogFilePath(workdir) {
  const logsDir = path.join(workdir, '.taskman', 'logs');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create log file name with date (YYYY-MM-DD)
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `chat-${date}.log`);
}

function appendToLog(workdir, entry) {
  try {
    const logsDir = path.join(workdir, '.taskman', 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = getLogFilePath(workdir);
    const timestamp = new Date().toISOString();
    const logEntry = `\n${'='.repeat(80)}\n[${timestamp}]\n${entry}\n`;
    
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (error) {
    // Silently fail in test environments or when path is invalid
    if (process.env.NODE_ENV !== 'test') {
      logger.debug(`Failed to write to log file: ${error?.message}`);
    }
  }
}

class KiroWrapper {
  constructor(workspaceService = null, database = null) {
    this.workspaceService = workspaceService;
    this.database = database;
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
  
  async chat(message, context = {}, onProgress = null, chatId = null) {
    logger.debug(`kiro-wrapper/chat:: Received message: ${message}`);
    logger.debug(`kiro-wrapper/chat:: Context: ${JSON.stringify(context, null, 2)}`);
    
    // Determine workdir from workspace service
    let workdir = process.cwd();
    if (this.workspaceService) {
      workdir = this.workspaceService.getWorkdirForKiro();
      logger.debug(`kiro-wrapper/chat:: Using workspace: ${workdir}`);
    }
    
    // Log user message
    appendToLog(workdir, `USER:\n${message}`);
    
    // Handle !bye command
    if (message.trim() === '!bye' || message.trim() === 'bye') {
      await this.clearSession(workdir, chatId);
      const response = '세션이 종료되었습니다. 다음 대화는 새로운 세션으로 시작됩니다.';
      appendToLog(workdir, `ASSISTANT:\n${response}`);
      return response;
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
      
      // Check session state to determine if we should resume
      let shouldResume = false;
      if (this.database && chatId) {
        const session = this.database.getChatSession(chatId);
        shouldResume = session && session.session_active === 1;
      }
      
      const resumeFlag = shouldResume ? '--resume' : '';
      
      const result = await this.executeCommandWithStreaming({
        command: `kiro-cli chat --no-interactive --trust-all-tools ${resumeFlag} -v '${escapedPrompt}'`,
        workdir: workdir,
        timeout: 60,
        onProgress: onProgress
      });
      
      if (result.code === 0) {
        // Activate session after successful message
        if (this.database && chatId) {
          this.database.activateChatSession(chatId, workdir);
        }
        
        const cleanOutput = stripAnsi(result.stdout.trim());
        logger.debug(`kiro-wrapper/chat:: Response: ${cleanOutput}`);
        
        // Filter out session resumption messages
        const filteredOutput = cleanOutput
          .split('\n')
          .filter(line => !line.includes('picking up where we left off'))
          .filter(line => !line.includes('Resuming session'))
          .join('\n')
          .trim();
        
        // Parse context info from stdout and stderr
        const contextInfo = this.parseContextInfo(result.stdout + result.stderr);
        
        // Format response with workspace and context info
        const finalResponse = this.formatResponse(filteredOutput, contextInfo, workdir);
        
        // Log assistant response
        appendToLog(workdir, `ASSISTANT:\n${finalResponse}`);
        
        return finalResponse;
      } else {
        logger.error(`kiro-wrapper/chat:: Kiro CLI failed with stderr: ${result.stderr}`);
        const errorMsg = result.stderr || 'Kiro CLI failed';
        appendToLog(workdir, `ERROR:\n${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (error) {
      logger.error(`kiro-wrapper/chat:: Error: ${error?.message}`);
      appendToLog(workdir, `ERROR:\n${error?.message}`);
      throw new Error(`Kiro CLI error: ${error?.message}`);
    }
  }
  
  async executeCommandWithStreaming({ command, workdir, timeout = 1800, onProgress = null }) {
    logger.debug(`kiro-wrapper/executeCommandWithStreaming:: Running command: ${command}`);
    
    return new Promise((resolve, reject) => {
      const childProcess = spawn('sh', ['-c', command], {
        cwd: workdir,
        env: { ...process.env },
        timeout: timeout * 1000
      });
      
      let stdout = '';
      let stderr = '';
      let buffer = '';
      
      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        buffer += chunk;
        
        // Send progress updates if callback provided
        if (onProgress) {
          // Split by newlines and send complete lines
          const lines = buffer.split('\n');
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              const cleanLine = stripAnsi(line);
              // Filter out noise
              if (!cleanLine.includes('picking up where we left off') &&
                  !cleanLine.includes('Resuming session')) {
                onProgress(cleanLine);
              }
            }
          }
        }
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      childProcess.on('close', (code) => {
        // Send any remaining buffer content
        if (onProgress && buffer.trim()) {
          const cleanLine = stripAnsi(buffer);
          if (!cleanLine.includes('picking up where we left off') &&
              !cleanLine.includes('Resuming session')) {
            onProgress(cleanLine);
          }
        }
        
        logger.debug(`kiro-wrapper/executeCommandWithStreaming:: Command exited with code ${code}`);
        resolve({ code, stdout, stderr });
      });
      
      childProcess.on('error', (error) => {
        logger.error(`kiro-wrapper/executeCommandWithStreaming:: Command error: ${error?.message}`);
        reject(error);
      });
    });
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
  
  async clearSession(workdir, chatId = null) {
    const sessionPath = path.join(workdir, '.kiro', 'sessions');
    
    if (!fs.existsSync(sessionPath)) {
      logger.debug(`Session path does not exist: ${sessionPath}`);
      // Still clear DB session if chatId provided
      if (this.database && chatId) {
        this.database.clearChatSession(chatId);
      }
      return;
    }
    
    try {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        const filePath = path.join(sessionPath, file);
        fs.unlinkSync(filePath);
        logger.debug(`Deleted session file: ${filePath}`);
      }
      
      // Clear DB session
      if (this.database && chatId) {
        this.database.clearChatSession(chatId);
      }
      
      logger.info(`Cleared session for workdir: ${workdir}`);
    } catch (error) {
      logger.error(`Failed to clear session: ${error.message}`);
    }
  }

  async clearSessionForCurrentWorkspace(chatId = null) {
    let workdir = process.cwd();
    if (this.workspaceService) {
      workdir = this.workspaceService.getWorkdirForKiro();
    }
    
    await this.clearSession(workdir, chatId);
    return `✅ 세션이 종료되었습니다.\n워크스페이스: ${workdir}\n\n다음 대화는 새로운 세션으로 시작됩니다.`;
  }
}

module.exports = KiroWrapper;
