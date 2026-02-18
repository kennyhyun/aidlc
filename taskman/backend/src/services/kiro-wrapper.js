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
  
  async chat(message, options = {}) {
    const command = `kiro chat "${message}"`;
    return this.executeCommand({
      command,
      workdir: options.workdir || process.cwd(),
      timeout: options.timeout || 1800
    });
  }
}

module.exports = KiroWrapper;
