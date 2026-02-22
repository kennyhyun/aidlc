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
});
