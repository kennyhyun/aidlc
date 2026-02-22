const WorkspaceService = require('../../src/services/workspace-service');
const DatabaseModel = require('../../src/models/database');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('WorkspaceService', () => {
  let service;
  let db;
  let tempDir;

  beforeEach(async () => {
    db = new DatabaseModel(':memory:');
    await db.initialize();
    
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    
    service = new WorkspaceService(db, null);
  });

  afterEach(async () => {
    await db.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should initialize with database', () => {
    expect(service).toBeDefined();
    expect(service.db).toBe(db);
  });

  describe('_validatePath', () => {
    test('should return true for existing directory', async () => {
      const result = service._validatePath(tempDir);
      expect(result).toBe(true);
    });

    test('should throw error for non-existent path', () => {
      expect(() => {
        service._validatePath('/non/existent/path');
      }).toThrow('폴더를 찾을 수 없습니다');
    });

    test('should throw error for file path', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test');
      
      expect(() => {
        service._validatePath(filePath);
      }).toThrow('유효한 폴더가 아닙니다');
    });
  });

  describe('getCurrentWorkspace', () => {
    test('should return null when no current workspace', () => {
      const result = service.getCurrentWorkspace();
      expect(result).toBeNull();
    });

    test('should return current workspace', () => {
      // Insert a workspace
      db.db.prepare(`
        INSERT INTO workspaces (path, is_current) VALUES (?, 1)
      `).run(tempDir);
      
      const result = service.getCurrentWorkspace();
      expect(result).toBeDefined();
      expect(result.path).toBe(tempDir);
      expect(result.is_current).toBe(1);
    });

    test('should return null if current workspace path does not exist', () => {
      // Insert a workspace with non-existent path
      db.db.prepare(`
        INSERT INTO workspaces (path, is_current) VALUES (?, 1)
      `).run('/non/existent/path');
      
      const result = service.getCurrentWorkspace();
      expect(result).toBeNull();
    });
  });

  describe('getDefaultWorkspace', () => {
    test('should return null when no default workspace', () => {
      const result = service.getDefaultWorkspace();
      expect(result).toBeNull();
    });

    test('should return default workspace', () => {
      db.db.prepare(`
        INSERT INTO workspaces (path, is_default) VALUES (?, 1)
      `).run(tempDir);
      
      const result = service.getDefaultWorkspace();
      expect(result).toBeDefined();
      expect(result.path).toBe(tempDir);
      expect(result.is_default).toBe(1);
    });

    test('should return null if default workspace path does not exist', () => {
      db.db.prepare(`
        INSERT INTO workspaces (path, is_default) VALUES (?, 1)
      `).run('/non/existent/path');
      
      const result = service.getDefaultWorkspace();
      expect(result).toBeNull();
    });
  });

  describe('switchWorkspace', () => {
    test('should switch to new workspace', () => {
      service.switchWorkspace(tempDir);
      
      const current = service.getCurrentWorkspace();
      expect(current).toBeDefined();
      expect(current.path).toBe(tempDir);
      expect(current.access_count).toBe(1);
    });

    test('should update existing workspace', () => {
      // First switch
      service.switchWorkspace(tempDir);
      
      // Second switch to same workspace
      service.switchWorkspace(tempDir);
      
      const current = service.getCurrentWorkspace();
      expect(current.access_count).toBe(2);
    });

    test('should unset previous current workspace', async () => {
      const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
      const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
      
      try {
        service.switchWorkspace(dir1);
        service.switchWorkspace(dir2);
        
        const allWorkspaces = db.db.prepare('SELECT * FROM workspaces').all();
        const currentCount = allWorkspaces.filter(w => w.is_current === 1).length;
        
        expect(currentCount).toBe(1);
        expect(service.getCurrentWorkspace().path).toBe(dir2);
      } finally {
        await fs.rm(dir1, { recursive: true, force: true });
        await fs.rm(dir2, { recursive: true, force: true });
      }
    });

    test('should throw error for non-existent path', () => {
      expect(() => {
        service.switchWorkspace('/non/existent/path');
      }).toThrow('폴더를 찾을 수 없습니다');
    });
  });

  describe('setDefaultWorkspace', () => {
    test('should set default workspace', () => {
      service.setDefaultWorkspace(tempDir);
      
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs).toBeDefined();
      expect(defaultWs.path).toBe(tempDir);
    });

    test('should unset previous default workspace', async () => {
      const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
      const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
      
      try {
        service.setDefaultWorkspace(dir1);
        service.setDefaultWorkspace(dir2);
        
        const allWorkspaces = db.db.prepare('SELECT * FROM workspaces').all();
        const defaultCount = allWorkspaces.filter(w => w.is_default === 1).length;
        
        expect(defaultCount).toBe(1);
        expect(service.getDefaultWorkspace().path).toBe(dir2);
      } finally {
        await fs.rm(dir1, { recursive: true, force: true });
        await fs.rm(dir2, { recursive: true, force: true });
      }
    });

    test('should throw error for non-existent path', () => {
      expect(() => {
        service.setDefaultWorkspace('/non/existent/path');
      }).toThrow('폴더를 찾을 수 없습니다');
    });
  });

  describe('switchToDefault', () => {
    test('should switch to default workspace', () => {
      service.setDefaultWorkspace(tempDir);
      service.switchToDefault();
      
      const current = service.getCurrentWorkspace();
      expect(current).toBeDefined();
      expect(current.path).toBe(tempDir);
    });

    test('should throw error when no default workspace', () => {
      expect(() => {
        service.switchToDefault();
      }).toThrow('디폴트 워크스페이스가 설정되지 않았습니다');
    });
  });

  describe('listWorkspaces', () => {
    test('should return empty array when no workspaces', () => {
      const result = service.listWorkspaces();
      expect(result).toEqual([]);
    });

    test('should return workspaces ordered by last_accessed_at', async () => {
      const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
      const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
      const dir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws3-'));
      
      try {
        service.switchWorkspace(dir1);
        service.switchWorkspace(dir2);
        service.switchWorkspace(dir3);
        
        const result = service.listWorkspaces();
        expect(result).toHaveLength(3);
        expect(result[0].path).toBe(dir3); // Most recent
        expect(result[2].path).toBe(dir1); // Oldest
      } finally {
        await fs.rm(dir1, { recursive: true, force: true });
        await fs.rm(dir2, { recursive: true, force: true });
        await fs.rm(dir3, { recursive: true, force: true });
      }
    });

    test('should respect limit parameter', async () => {
      const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
      const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
      const dir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws3-'));
      
      try {
        service.switchWorkspace(dir1);
        service.switchWorkspace(dir2);
        service.switchWorkspace(dir3);
        
        const result = service.listWorkspaces(2);
        expect(result).toHaveLength(2);
      } finally {
        await fs.rm(dir1, { recursive: true, force: true });
        await fs.rm(dir2, { recursive: true, force: true });
        await fs.rm(dir3, { recursive: true, force: true });
      }
    });
  });

  describe('_findExistingTaskWorkdir', () => {
    beforeEach(() => {
      // Mock taskManager
      service.taskManager = {
        getAllTasks: jest.fn()
      };
    });

    test('should return null when no tasks', () => {
      service.taskManager.getAllTasks.mockReturnValue([]);
      
      const result = service._findExistingTaskWorkdir();
      expect(result).toBeNull();
    });

    test('should return first existing workdir', async () => {
      const existingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'existing-'));
      
      try {
        service.taskManager.getAllTasks.mockReturnValue([
          { workdir: '/non/existent/path' },
          { workdir: existingDir },
          { workdir: tempDir }
        ]);
        
        const result = service._findExistingTaskWorkdir();
        expect(result).toBe(existingDir);
      } finally {
        await fs.rm(existingDir, { recursive: true, force: true });
      }
    });

    test('should return null when all workdirs do not exist', () => {
      service.taskManager.getAllTasks.mockReturnValue([
        { workdir: '/non/existent/path1' },
        { workdir: '/non/existent/path2' }
      ]);
      
      const result = service._findExistingTaskWorkdir();
      expect(result).toBeNull();
    });

    test('should handle tasks without workdir', () => {
      service.taskManager.getAllTasks.mockReturnValue([
        { workdir: null },
        { workdir: undefined },
        { workdir: tempDir }
      ]);
      
      const result = service._findExistingTaskWorkdir();
      expect(result).toBe(tempDir);
    });
  });

  describe('ensureDefaultWorkspace', () => {
    beforeEach(() => {
      service.taskManager = {
        getAllTasks: jest.fn().mockReturnValue([])
      };
    });

    test('should not change existing default workspace', () => {
      service.setDefaultWorkspace(tempDir);
      service.ensureDefaultWorkspace();
      
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs.path).toBe(tempDir);
    });

    test('should set current as default if no default exists', async () => {
      const currentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'current-'));
      
      try {
        service.switchWorkspace(currentDir);
        service.ensureDefaultWorkspace();
        
        const defaultWs = service.getDefaultWorkspace();
        expect(defaultWs.path).toBe(currentDir);
      } finally {
        await fs.rm(currentDir, { recursive: true, force: true });
      }
    });

    test('should use task workdir if no current or default', async () => {
      const taskDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-'));
      
      try {
        service.taskManager.getAllTasks.mockReturnValue([
          { workdir: taskDir }
        ]);
        
        service.ensureDefaultWorkspace();
        
        const defaultWs = service.getDefaultWorkspace();
        expect(defaultWs.path).toBe(taskDir);
      } finally {
        await fs.rm(taskDir, { recursive: true, force: true });
      }
    });

    test('should use process.cwd() as last resort', () => {
      service.ensureDefaultWorkspace();
      
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs.path).toBe(process.cwd());
    });
  });

  describe('getWorkdirForKiro', () => {
    beforeEach(() => {
      service.taskManager = {
        getAllTasks: jest.fn().mockReturnValue([])
      };
    });

    test('should return current workspace if exists', () => {
      service.switchWorkspace(tempDir);
      
      const workdir = service.getWorkdirForKiro();
      expect(workdir).toBe(tempDir);
    });

    test('should return default workspace if no current', () => {
      service.setDefaultWorkspace(tempDir);
      
      const workdir = service.getWorkdirForKiro();
      expect(workdir).toBe(tempDir);
    });

    test('should call ensureDefaultWorkspace if both missing', () => {
      const workdir = service.getWorkdirForKiro();
      expect(workdir).toBe(process.cwd());
      
      // Verify default was set
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs).toBeDefined();
    });
  });

  describe('deleteWorkspace', () => {
    test('should delete workspace by id', () => {
      service.switchWorkspace(tempDir);
      const workspace = service.getCurrentWorkspace();
      
      service.deleteWorkspace(workspace.id);
      
      const result = db.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace.id);
      expect(result).toBeUndefined();
    });

    test('should not throw error for non-existent id', () => {
      expect(() => {
        service.deleteWorkspace(99999);
      }).not.toThrow();
    });
  });
});
