const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

class WorkspaceService {
  constructor(db, taskManager) {
    this.db = db;
    this.taskManager = taskManager;
  }

  _validatePath(dirPath) {
    if (!fs.existsSync(dirPath)) {
      const error = new Error('폴더를 찾을 수 없습니다');
      error.code = 'WORKSPACE_NOT_FOUND';
      throw error;
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      const error = new Error('유효한 폴더가 아닙니다');
      error.code = 'WORKSPACE_NOT_DIRECTORY';
      throw error;
    }
    
    return true;
  }
}

module.exports = WorkspaceService;
