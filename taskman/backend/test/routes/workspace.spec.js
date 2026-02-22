const fastify = require('fastify');
const workspaceRoutes = require('../../src/routes/workspace');
const WorkspaceService = require('../../src/services/workspace-service');
const DatabaseModel = require('../../src/models/database');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Workspace Routes', () => {
  let app;
  let db;
  let service;
  let tempDir;

  beforeEach(async () => {
    app = fastify();
    db = new DatabaseModel(':memory:');
    await db.initialize();
    
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    
    service = new WorkspaceService(db, null);
    
    app.decorate('workspaceService', service);
    app.register(workspaceRoutes);
    
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/workspace', () => {
    test('should return current workspace', async () => {
      service.switchWorkspace(tempDir);
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspace'
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.path).toBe(tempDir);
    });

    test('should return 404 when no current workspace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspace'
      });
      
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/workspace/switch', () => {
    test('should switch workspace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/switch',
        payload: { path: tempDir }
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.workspace.path).toBe(tempDir);
    });

    test('should return 400 for non-existent path', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/switch',
        payload: { path: '/non/existent/path' }
      });
      
      expect(response.statusCode).toBe(400);
    });

    test('should return 400 for missing path', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/switch',
        payload: {}
      });
      
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/workspace/default', () => {
    test('should set default workspace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/default',
        payload: { path: tempDir }
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    test('should return 400 for non-existent path', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/default',
        payload: { path: '/non/existent/path' }
      });
      
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/workspace/default', () => {
    test('should return default workspace', async () => {
      service.setDefaultWorkspace(tempDir);
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspace/default'
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.path).toBe(tempDir);
    });

    test('should return 404 when no default workspace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspace/default'
      });
      
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/workspace/list', () => {
    test('should list workspaces', async () => {
      service.switchWorkspace(tempDir);
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspace/list'
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workspaces).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    test('should respect limit parameter', async () => {
      const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
      const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
      
      try {
        service.switchWorkspace(dir1);
        service.switchWorkspace(dir2);
        
        const response = await app.inject({
          method: 'GET',
          url: '/api/workspace/list?limit=1'
        });
        
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.workspaces).toHaveLength(1);
      } finally {
        await fs.rm(dir1, { recursive: true, force: true });
        await fs.rm(dir2, { recursive: true, force: true });
      }
    });
  });

  describe('DELETE /api/workspace/:id', () => {
    test('should delete workspace', async () => {
      service.switchWorkspace(tempDir);
      const workspace = service.getCurrentWorkspace();
      
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/workspace/${workspace.id}`
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
