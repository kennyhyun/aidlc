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

  getCurrentWorkspace() {
    const stmt = this.db.db.prepare(`
      SELECT * FROM workspaces WHERE is_current = 1 LIMIT 1
    `);
    const workspace = stmt.get();
    
    if (!workspace) {
      return null;
    }
    
    // Verify path still exists
    try {
      this._validatePath(workspace.path);
      return workspace;
    } catch (error) {
      logger.warn(`Current workspace path no longer exists: ${workspace.path}`);
      return null;
    }
  }

  getDefaultWorkspace() {
    const stmt = this.db.db.prepare(`
      SELECT * FROM workspaces WHERE is_default = 1 LIMIT 1
    `);
    const workspace = stmt.get();
    
    if (!workspace) {
      return null;
    }
    
    // Verify path still exists
    try {
      this._validatePath(workspace.path);
      return workspace;
    } catch (error) {
      logger.warn(`Default workspace path no longer exists: ${workspace.path}`);
      return null;
    }
  }

  switchWorkspace(dirPath) {
    // Validate path
    this._validatePath(dirPath);
    
    // Use transaction
    const transaction = this.db.db.transaction(() => {
      // Unset current workspace
      this.db.db.prepare(`
        UPDATE workspaces SET is_current = 0 WHERE is_current = 1
      `).run();
      
      // Check if workspace exists
      const existing = this.db.db.prepare(`
        SELECT * FROM workspaces WHERE path = ?
      `).get(dirPath);
      
      if (existing) {
        // Update existing workspace
        this.db.db.prepare(`
          UPDATE workspaces 
          SET is_current = 1, 
              last_accessed_at = CURRENT_TIMESTAMP,
              access_count = access_count + 1
          WHERE path = ?
        `).run(dirPath);
      } else {
        // Insert new workspace
        this.db.db.prepare(`
          INSERT INTO workspaces (path, is_current, access_count)
          VALUES (?, 1, 1)
        `).run(dirPath);
      }
    });
    
    transaction();
    
    logger.info(`Switched to workspace: ${dirPath}`);
    return this.getCurrentWorkspace();
  }
}

module.exports = WorkspaceService;
