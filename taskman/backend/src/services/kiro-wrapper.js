const { spawn } = require('child_process');

class KiroWrapper {
  async executeCommand({ command, workdir, timeout = 1800 }) {
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
        resolve({ code, stdout, stderr });
      });
      
      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  async chat(message, context = {}) {
    // Build context string for Kiro
    const contextStr = JSON.stringify(context, null, 2);
    
    // Escape quotes in message
    const escapedMessage = message.replace(/'/g, "'\\''");
    
    // Create a prompt with context
    const prompt = `Context:\n${contextStr}\n\nUser message: ${message}\n\nPlease help the user with their task management request.`;
    
    try {
      const result = await this.executeCommand({
        command: `kiro chat '${escapedMessage}'`,
        workdir: process.cwd(),
        timeout: 60
      });
      
      if (result.code === 0) {
        return result.stdout.trim();
      } else {
        throw new Error(result.stderr || 'Kiro chat failed');
      }
    } catch (error) {
      throw new Error(`Kiro chat error: ${error?.message}`);
    }
  }
}

module.exports = KiroWrapper;
