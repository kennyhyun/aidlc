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

  setDefaultWorkspace(dirPath) {
    // Validate path
    this._validatePath(dirPath);
    
    // Use transaction
    const transaction = this.db.db.transaction(() => {
      // Unset default workspace
      this.db.db.prepare(`
        UPDATE workspaces SET is_default = 0 WHERE is_default = 1
      `).run();
      
      // Check if workspace exists
      const existing = this.db.db.prepare(`
        SELECT * FROM workspaces WHERE path = ?
      `).get(dirPath);
      
      if (existing) {
        // Update existing workspace
        this.db.db.prepare(`
          UPDATE workspaces SET is_default = 1 WHERE path = ?
        `).run(dirPath);
      } else {
        // Insert new workspace
        this.db.db.prepare(`
          INSERT INTO workspaces (path, is_default) VALUES (?, 1)
        `).run(dirPath);
      }
    });
    
    transaction();
    
    logger.info(`Set default workspace: ${dirPath}`);
    return this.getDefaultWorkspace();
  }

  switchToDefault() {
    const defaultWs = this.getDefaultWorkspace();
    
    if (!defaultWs) {
      const error = new Error('디폴트 워크스페이스가 설정되지 않았습니다');
      error.code = 'NO_DEFAULT_WORKSPACE';
      throw error;
    }
    
    return this.switchWorkspace(defaultWs.path);
  }

  listWorkspaces(limit = 10) {
    const stmt = this.db.db.prepare(`
      SELECT * FROM workspaces 
      ORDER BY last_accessed_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  _findExistingTaskWorkdir() {
    if (!this.taskManager) {
      return null;
    }
    
    const tasks = this.taskManager.getAllTasks();
    
    for (const task of tasks) {
      if (!task.workdir) {
        continue;
      }
      
      try {
        if (fs.existsSync(task.workdir) && fs.statSync(task.workdir).isDirectory()) {
          return task.workdir;
        }
      } catch (error) {
        // Skip invalid paths
        continue;
      }
    }
    
    return null;
  }

  ensureDefaultWorkspace() {
    // Check if default exists and is valid
    const defaultWs = this.getDefaultWorkspace();
    if (defaultWs) {
      logger.debug('Default workspace already exists');
      return defaultWs;
    }
    
    logger.info('No default workspace found, initializing...');
    
    // Try current workspace
    const currentWs = this.getCurrentWorkspace();
    if (currentWs) {
      logger.info(`Setting current workspace as default: ${currentWs.path}`);
      this.setDefaultWorkspace(currentWs.path);
      return this.getDefaultWorkspace();
    }
    
    // Try task workdir
    const taskWorkdir = this._findExistingTaskWorkdir();
    if (taskWorkdir) {
      logger.info(`Setting task workdir as default: ${taskWorkdir}`);
      this.setDefaultWorkspace(taskWorkdir);
      return this.getDefaultWorkspace();
    }
    
    // Use process.cwd() as last resort
    const cwd = process.cwd();
    logger.info(`Setting process.cwd() as default: ${cwd}`);
    this.setDefaultWorkspace(cwd);
    return this.getDefaultWorkspace();
  }

  getWorkdirForKiro() {
    // Try current workspace
    const currentWs = this.getCurrentWorkspace();
    if (currentWs) {
      return currentWs.path;
    }
    
    // Try default workspace
    const defaultWs = this.getDefaultWorkspace();
    if (defaultWs) {
      return defaultWs.path;
    }
    
    // Ensure default exists and return it
    const ensuredDefault = this.ensureDefaultWorkspace();
    return ensuredDefault.path;
  }

  deleteWorkspace(id) {
    const stmt = this.db.db.prepare(`
      DELETE FROM workspaces WHERE id = ?
    `);
    
    stmt.run(id);
    logger.info(`Deleted workspace: ${id}`);
  }
}

module.exports = WorkspaceService;
