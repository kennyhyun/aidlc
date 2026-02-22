const DatabaseModel = require('../../src/models/database');

describe('DatabaseModel - Workspaces', () => {
  let db;
  const testDbPath = ':memory:';

  beforeEach(async () => {
    db = new DatabaseModel(testDbPath);
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create workspaces table', () => {
    const tables = db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'"
    ).all();
    
    expect(tables).toHaveLength(1);
  });

  test('workspaces table should have correct schema', () => {
    const columns = db.db.prepare('PRAGMA table_info(workspaces)').all();
    const columnNames = columns.map(c => c.name);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('path');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('is_current');
    expect(columnNames).toContain('is_default');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('last_accessed_at');
    expect(columnNames).toContain('access_count');
  });
});
