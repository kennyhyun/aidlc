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
});
