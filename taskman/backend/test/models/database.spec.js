const Database = require('../../src/models/database');
const { promises: fs } = require('fs');
const path = require('path');

describe('Database', () => {
  let db;
  const testDbPath = path.join(__dirname, '../fixtures/test.db');
  
  beforeEach(async () => {
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });
    db = new Database(testDbPath);
    await db.initialize();
  });
  
  afterEach(async () => {
    await db.close();
    await fs.unlink(testDbPath).catch(() => {});
  });
  
  test('should create tables on initialization', async () => {
    const tables = db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('task_executions');
    expect(tableNames).toContain('dag_executions');
    expect(tableNames).toContain('task_definitions');
    expect(tableNames).toContain('settings');
  });
  
  test('should insert and retrieve task execution', async () => {
    const execution = {
      task_id: 'test-task-a3f2',
      task_name: 'Test Task',
      status: 'running',
      started_at: new Date().toISOString(),
      triggered_by: 'manual'
    };
    
    const id = db.insertTaskExecution(execution);
    expect(id).toBeGreaterThan(0);
    
    const retrieved = db.getTaskExecution(id);
    expect(retrieved.task_id).toBe(execution.task_id);
    expect(retrieved.status).toBe('running');
  });
  
  describe('chat_sessions table', () => {
    test('should create and retrieve chat session', () => {
      db.upsertChatSession('chat123', '/test/workspace', true);
      
      const session = db.getChatSession('chat123');
      expect(session).toBeDefined();
      expect(session.chat_id).toBe('chat123');
      expect(session.workspace_path).toBe('/test/workspace');
      expect(session.session_active).toBe(1);
    });
    
    test('should update existing chat session', () => {
      db.upsertChatSession('chat123', '/test/workspace', true);
      db.upsertChatSession('chat123', '/new/workspace', false);
      
      const session = db.getChatSession('chat123');
      expect(session.workspace_path).toBe('/new/workspace');
      expect(session.session_active).toBe(0);
    });
    
    test('should clear chat session', () => {
      db.upsertChatSession('chat123', '/test/workspace', true);
      db.clearChatSession('chat123');
      
      const session = db.getChatSession('chat123');
      expect(session.session_active).toBe(0);
    });
    
    test('should activate chat session', () => {
      db.upsertChatSession('chat123', '/test/workspace', false);
      db.activateChatSession('chat123', '/test/workspace');
      
      const session = db.getChatSession('chat123');
      expect(session.session_active).toBe(1);
    });
    
    test('should return undefined for non-existent chat session', () => {
      const session = db.getChatSession('nonexistent');
      expect(session).toBeUndefined();
    });
  });
});
