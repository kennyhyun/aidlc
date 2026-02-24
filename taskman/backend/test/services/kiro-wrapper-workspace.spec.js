const KiroWrapper = require('../../src/services/kiro-wrapper');
const WorkspaceService = require('../../src/services/workspace-service');
const DatabaseModel = require('../../src/models/database');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('KiroWrapper - Workspace Integration', () => {
  let kiroWrapper;
  let workspaceService;
  let db;
  let tempDir;

  beforeEach(async () => {
    db = new DatabaseModel(':memory:');
    await db.initialize();
    
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    
    workspaceService = new WorkspaceService(db, null);
    kiroWrapper = new KiroWrapper(workspaceService);
  });

  afterEach(async () => {
    await db.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should use current workspace for kiro-cli', async () => {
    workspaceService.switchWorkspace(tempDir);
    
    // Mock executeCommandWithStreaming to capture workdir
    let capturedWorkdir;
    kiroWrapper.executeCommandWithStreaming = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    await kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(tempDir);
  });

  test('should use default workspace when no current', async () => {
    workspaceService.setDefaultWorkspace(tempDir);
    
    let capturedWorkdir;
    kiroWrapper.executeCommandWithStreaming = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    await kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(tempDir);
  });

  test('should use process.cwd() when no workspace configured', async () => {
    let capturedWorkdir;
    kiroWrapper.executeCommandWithStreaming = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    await kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(process.cwd());
  });

  test('should work without workspace service', async () => {
    const wrapperWithoutWorkspace = new KiroWrapper();
    
    let capturedWorkdir;
    wrapperWithoutWorkspace.executeCommandWithStreaming = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    await wrapperWithoutWorkspace.chat('test message');
    
    expect(capturedWorkdir).toBe(process.cwd());
  });
});
