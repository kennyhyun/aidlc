const Database = require('better-sqlite3');
const { promises: fs } = require('fs');
const path = require('path');

class DatabaseModel {
  constructor(dbPath = './data/aidlc.db') {
    this.dbPath = dbPath;
    this.db = null;
  }
  
  async initialize() {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    
    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.createTables();
    this.createIndexes();
  }
  
  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at DATETIME,
        completed_at DATETIME,
        duration INTEGER,
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        triggered_by TEXT,
        parent_execution_id INTEGER,
        FOREIGN KEY (parent_execution_id) REFERENCES dag_executions(id)
      );
      
      CREATE TABLE IF NOT EXISTS dag_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        status TEXT NOT NULL,
        triggered_by TEXT,
        total_tasks INTEGER,
        completed_tasks INTEGER,
        failed_tasks INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS task_definitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        last_updated DATETIME NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME NOT NULL
      );
    `);
  }
  
  createIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_executions_task_id 
        ON task_executions(task_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_task_executions_status 
        ON task_executions(status);
      CREATE INDEX IF NOT EXISTS idx_dag_executions_started_at 
        ON dag_executions(started_at);
    `);
  }
  
  insertTaskExecution(execution) {
    const stmt = this.db.prepare(`
      INSERT INTO task_executions 
      (task_id, task_name, status, started_at, triggered_by, parent_execution_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      execution.task_id,
      execution.task_name,
      execution.status,
      execution.started_at,
      execution.triggered_by,
      execution.parent_execution_id || null
    );
    
    return result.lastInsertRowid;
  }

  getTaskExecution(id) {
    const stmt = this.db.prepare('SELECT * FROM task_executions WHERE id = ?');
    return stmt.get(id);
  }

  updateTaskExecution(id, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    
    const stmt = this.db.prepare(`
      UPDATE task_executions SET ${fields} WHERE id = ?
    `);
    
    stmt.run(...values, id);
  }

  getRunningExecutions() {
    const stmt = this.db.prepare(`
      SELECT * FROM task_executions 
      WHERE status = 'running' 
      ORDER BY started_at DESC
    `);
    return stmt.all();
  }
  
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseModel;
