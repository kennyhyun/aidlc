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
});
