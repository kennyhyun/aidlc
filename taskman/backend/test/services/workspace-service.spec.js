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
});
