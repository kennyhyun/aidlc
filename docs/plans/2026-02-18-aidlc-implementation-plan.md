# AIDLC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Docker Compose-based AI Development Lifecycle Controller that automates long-running development tasks using Kiro CLI, manages task dependencies with DAG, and provides Telegram/Slack interface for monitoring and control.

**Architecture:** Fastify-based Node.js server with SQLite persistence, DAG engine for task orchestration, Kiro CLI wrapper for AI-assisted execution, and messaging platform adapters for user interaction. Alpine-cron container triggers scheduled tasks via HTTP endpoints.

**Tech Stack:** Node.js 22, Fastify, SQLite (better-sqlite3), node-telegram-bot-api, @slack/bolt, js-yaml, chokidar, Kiro CLI

**Design Documents:**
- [System Design](./2026-02-18-aidlc-design.md) - Overall architecture
- [DAG Engine Design](./2026-02-18-dag-engine-design.md) - Task dependency management
- [Messaging Platform Design](./2026-02-18-messaging-platform-design.md) - Telegram/Slack integration

---

## Implementation Phases

### Phase 1: Foundation (Tasks 1-6)
Core infrastructure, database, configuration, and server setup.

### Phase 2: DAG Engine (Tasks 7-10)
Task dependency management, execution engine, and file watching.
**Reference:** [DAG Engine Design](./2026-02-18-dag-engine-design.md)

### Phase 3: Messaging Platform (Tasks 11-14)
Telegram/Slack adapters, command handling, and notifications.
**Reference:** [Messaging Platform Design](./2026-02-18-messaging-platform-design.md)

### Phase 4: Integration (Tasks 15-18)
API routes, task manager service, and Docker setup.

### Phase 5: Testing & Deployment (Tasks 19-20)
End-to-end tests and production deployment.

---

## Task 1: Project Setup and Dependencies

**Files:**
- Create: `aidlc/package.json`
- Create: `aidlc/.env.example`
- Create: `aidlc/.gitignore`
- Create: `aidlc/README.md`

**Step 1: Initialize Node.js project**

```bash
cd aidlc
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install fastify @fastify/swagger @fastify/swagger-ui \
  better-sqlite3 js-yaml chokidar \
  node-telegram-bot-api @slack/bolt \
  pino pino-pretty lodash.debounce
```

**Step 3: Install dev dependencies**

```bash
npm install --save-dev jest @types/jest nodemon
```

**Step 4: Create .env.example**

```bash
# .env.example
# Server
PORT=8254
NODE_ENV=development
LOG_LEVEL=info

# Database
DATABASE_PATH=./data/aidlc.db

# Messaging Platform
MESSAGING_PLATFORM=telegram

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_POLLING_INTERVAL=300
TELEGRAM_POLLING_TIMEOUT=10

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL_ID=C1234567890

# Task Configuration
MAX_CONCURRENT_TASKS=3
TASK_CONFIG_DIR=./config/tasks
TASK_RELOAD_DEBOUNCE=60000

# Kiro CLI
KIRO_CONFIG_PATH=/root/.kiro
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
data/
.env
*.log
.DS_Store
```

**Step 6: Update package.json scripts**

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"]
  }
}
```

**Step 7: Create README.md**

```markdown
# AIDLC - AI Development Lifecycle Controller

Docker Compose-based automation system for AI-assisted development tasks.

## Quick Start

1. Copy `.env.example` to `.env` and configure
2. Run `docker-compose up -d`
3. Interact via Telegram or Slack

See `docs/plans/` for detailed documentation.
```

**Step 8: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore README.md
git commit -m "feat: initialize AIDLC project with dependencies"
```

---

## Task 2: Database Schema and Models

**Files:**
- Create: `aidlc/src/models/database.js`
- Create: `aidlc/test/models/database.spec.js`

**Step 1: Write failing test for database initialization**

```javascript
// test/models/database.spec.js
const Database = require('../../src/models/database');
const fs = require('fs').promises;
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
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- test/models/database.spec.js
```

Expected: FAIL with "Cannot find module '../../src/models/database'"

**Step 3: Implement database initialization**

```javascript
// src/models/database.js
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
  
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseModel;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- test/models/database.spec.js
```

Expected: PASS

**Step 5: Add CRUD methods test**

```javascript
// test/models/database.spec.js (add to existing file)
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
```

**Step 6: Implement CRUD methods**

```javascript
// src/models/database.js (add to class)
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
```

**Step 7: Run tests**

```bash
npm test -- test/models/database.spec.js
```

Expected: PASS

**Step 8: Commit**

```bash
git add src/models/database.js test/models/database.spec.js
git commit -m "feat: add database schema and CRUD operations"
```

---

## Task 3: Configuration Loader (YAML Parser)

**Files:**
- Create: `aidlc/src/shared/config-loader.js`
- Create: `aidlc/test/shared/config-loader.spec.js`
- Create: `aidlc/test/fixtures/tasks/sample.yaml`

**Step 1: Create test fixture**

```yaml
# test/fixtures/tasks/sample.yaml
tasks:
  - name: "Build Backend"
    command: "kiro chat 'Build backend'"
    workdir: "/storage/project"
    timeout: 1800
    
  - name: "Run Tests"
    needs: ["Build Backend"]
    command: "kiro chat 'Run tests'"
    timeout: 600
```

**Step 2: Write failing test**

```javascript
// test/shared/config-loader.spec.js
const ConfigLoader = require('../../src/shared/config-loader');
const path = require('path');

describe('ConfigLoader', () => {
  let loader;
  
  beforeEach(() => {
    loader = new ConfigLoader(path.join(__dirname, '../fixtures/tasks'));
  });
  
  test('should load tasks from YAML files', async () => {
    const tasks = await loader.loadTasks();
    
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('Build Backend');
    expect(tasks[1].name).toBe('Run Tests');
  });
  
  test('should generate IDs for tasks without them', async () => {
    const tasks = await loader.loadTasks();
    
    tasks.forEach(task => {
      expect(task.id).toMatch(/^[\w-]+-[0-9a-f]{4}$/);
    });
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- test/shared/config-loader.spec.js
```

Expected: FAIL

**Step 4: Implement config loader**

```javascript
// src/shared/config-loader.js
const yaml = require('js-yaml');
const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigLoader {
  constructor(configDir = './config/tasks') {
    this.configDir = configDir;
  }
  
  async loadTasks() {
    const files = await this.getYamlFiles();
    const allTasks = [];
    
    for (const file of files) {
      const tasks = await this.loadTasksFromFile(file);
      allTasks.push(...tasks);
    }
    
    // Generate IDs for tasks without them
    allTasks.forEach(task => {
      if (!task.id) {
        task.id = this.generateTaskId(task.name);
      }
    });
    
    return allTasks;
  }
  
  async getYamlFiles() {
    const entries = await fs.readdir(this.configDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.yaml'))
      .map(entry => path.join(this.configDir, entry.name));
  }
  
  async loadTasksFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(content);
    
    if (!data || !data.tasks) {
      return [];
    }
    
    return data.tasks.map(task => ({
      ...task,
      filePath
    }));
  }
  
  generateTaskId(name) {
    const slug = this.slugify(name);
    const hex = crypto.randomBytes(2).toString('hex');
    return `${slug}-${hex}`;
  }
  
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = ConfigLoader;
```

**Step 5: Run test to verify it passes**

```bash
npm test -- test/shared/config-loader.spec.js
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/config-loader.js test/shared/config-loader.spec.js test/fixtures/
git commit -m "feat: add YAML configuration loader with ID generation"
```

---

## Task 4: DAG Engine - Core Graph Operations

**Files:**
- Create: `aidlc/src/shared/dag-engine.js`
- Create: `aidlc/test/shared/dag-engine.spec.js`

**Step 1: Write failing test for graph construction**

```javascript
// test/shared/dag-engine.spec.js
const DAGEngine = require('../../src/shared/dag-engine');

describe('DAGEngine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new DAGEngine();
  });
  
  test('should build graph from tasks', () => {
    const tasks = [
      { id: 'build-a3f2', name: 'Build', needs: [] },
      { id: 'test-7b4e', name: 'Test', needs: ['build-a3f2'] },
      { id: 'deploy-c8d1', name: 'Deploy', needs: ['build-a3f2', 'test-7b4e'] }
    ];
    
    const graph = engine.buildGraph(tasks);
    
    expect(graph.nodes.size).toBe(3);
    expect(graph.nodes.get('test-7b4e').dependencies.size).toBe(1);
    expect(graph.nodes.get('deploy-c8d1').dependencies.size).toBe(2);
  });
  
  test('should detect circular dependencies', () => {
    const tasks = [
      { id: 'a', name: 'A', needs: ['b'] },
      { id: 'b', name: 'B', needs: ['c'] },
      { id: 'c', name: 'C', needs: ['a'] }
    ];
    
    expect(() => engine.buildGraph(tasks)).toThrow('Circular dependency');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- test/shared/dag-engine.spec.js
```

Expected: FAIL

**Step 3: Implement DAG engine**

```javascript
// src/shared/dag-engine.js
class DAGEngine {
  buildGraph(tasks) {
    const graph = {
      nodes: new Map(),
      edges: new Map()
    };
    
    // Add all nodes
    tasks.forEach(task => {
      graph.nodes.set(task.id, {
        id: task.id,
        name: task.name,
        config: task,
        inDegree: 0,
        dependencies: new Set(),
        dependents: new Set()
      });
    });
    
    // Add edges
    tasks.forEach(task => {
      const needs = task.needs || [];
      needs.forEach(depId => {
        this.addDependency(graph, task.id, depId);
      });
    });
    
    // Detect cycles
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      throw new Error(`Circular dependency detected: ${cycles[0].join(' → ')}`);
    }
    
    return graph;
  }
  
  addDependency(graph, taskId, dependsOnId) {
    const task = graph.nodes.get(taskId);
    const dependency = graph.nodes.get(dependsOnId);
    
    if (!task || !dependency) {
      throw new Error(`Task not found: ${taskId} or ${dependsOnId}`);
    }
    
    task.dependencies.add(dependsOnId);
    dependency.dependents.add(taskId);
    task.inDegree++;
  }
  
  detectCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const node = graph.nodes.get(nodeId);
      node.dependencies.forEach(depId => {
        dfs(depId, [...path]);
      });
      
      recursionStack.delete(nodeId);
    };
    
    graph.nodes.forEach((node, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    });
    
    return cycles;
  }
  
  topologicalSort(graph) {
    const sorted = [];
    const queue = [];
    const inDegree = new Map();
    
    graph.nodes.forEach((node, id) => {
      inDegree.set(id, node.inDegree);
      if (node.inDegree === 0) {
        queue.push(id);
      }
    });
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      sorted.push(nodeId);
      
      const node = graph.nodes.get(nodeId);
      node.dependents.forEach(dependentId => {
        const newDegree = inDegree.get(dependentId) - 1;
        inDegree.set(dependentId, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      });
    }
    
    if (sorted.length !== graph.nodes.size) {
      throw new Error('Graph has cycles');
    }
    
    return sorted;
  }
}

module.exports = DAGEngine;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- test/shared/dag-engine.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/dag-engine.js test/shared/dag-engine.spec.js
git commit -m "feat: add DAG engine with cycle detection and topological sort"
```

---

## Task 5: Kiro CLI Wrapper

**Files:**
- Create: `aidlc/src/services/kiro-wrapper.js`
- Create: `aidlc/test/services/kiro-wrapper.spec.js`

**Step 1: Write failing test**

```javascript
// test/services/kiro-wrapper.spec.js
const KiroWrapper = require('../../src/services/kiro-wrapper');

describe('KiroWrapper', () => {
  let wrapper;
  
  beforeEach(() => {
    wrapper = new KiroWrapper();
  });
  
  test('should execute kiro command', async () => {
    const result = await wrapper.executeCommand({
      command: 'echo "test"',
      workdir: process.cwd(),
      timeout: 5
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('test');
  }, 10000);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- test/services/kiro-wrapper.spec.js
```

Expected: FAIL

**Step 3: Implement Kiro wrapper**

```javascript
// src/services/kiro-wrapper.js
const { spawn } = require('child_process');

class KiroWrapper {
  async executeCommand({ command, workdir, timeout = 1800 }) {
    return new Promise((resolve, reject) => {
      const process = spawn('sh', ['-c', command], {
        cwd: workdir,
        env: { ...process.env },
        timeout: timeout * 1000
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  async chat(message, options = {}) {
    // Placeholder for Kiro CLI integration
    const command = `kiro chat "${message}"`;
    return this.executeCommand({
      command,
      workdir: options.workdir || process.cwd(),
      timeout: options.timeout || 1800
    });
  }
}

module.exports = KiroWrapper;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- test/services/kiro-wrapper.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/kiro-wrapper.js test/services/kiro-wrapper.spec.js
git commit -m "feat: add Kiro CLI wrapper for command execution"
```

---

## Task 6: Fastify Server Setup

**Files:**
- Create: `aidlc/src/server.js`
- Create: `aidlc/src/config/index.js`

**Step 1: Create configuration**

```javascript
// src/config/index.js
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 8254,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    path: process.env.DATABASE_PATH || './data/aidlc.db'
  },
  
  messaging: {
    platform: process.env.MESSAGING_PLATFORM || 'telegram',
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      pollingInterval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL) || 300,
      pollingTimeout: parseInt(process.env.TELEGRAM_POLLING_TIMEOUT) || 10
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      channelId: process.env.SLACK_CHANNEL_ID
    }
  },
  
  tasks: {
    maxConcurrent: Math.min(Math.max(parseInt(process.env.MAX_CONCURRENT_TASKS) || 3, 1), 8),
    configDir: process.env.TASK_CONFIG_DIR || './config/tasks',
    reloadDebounce: parseInt(process.env.TASK_RELOAD_DEBOUNCE) || 60000
  },
  
  kiro: {
    configPath: process.env.KIRO_CONFIG_PATH || '/root/.kiro'
  }
};
```

**Step 2: Create Fastify server**

```javascript
// src/server.js
const fastify = require('fastify')({
  logger: {
    level: require('./config').logLevel,
    transport: {
      target: 'pino-pretty'
    }
  }
});

const config = require('./config');
const Database = require('./models/database');

// Register Swagger
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'AIDLC API',
      version: '1.0.0',
      description: 'AI Development Lifecycle Controller API'
    }
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs'
});

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
});

// Initialize database
let db;

fastify.addHook('onReady', async () => {
  db = new Database(config.database.path);
  await db.initialize();
  fastify.log.info('Database initialized');
});

fastify.addHook('onClose', async () => {
  if (db) {
    await db.close();
    fastify.log.info('Database closed');
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${config.port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
```

**Step 3: Test server startup**

```bash
npm run dev
```

Expected: Server starts on port 8254, visit http://localhost:8254/health

**Step 4: Commit**

```bash
git add src/server.js src/config/index.js
git commit -m "feat: add Fastify server with Swagger and health check"
```

---

## Phase 2: DAG Engine Implementation

**Reference:** [DAG Engine Design](./2026-02-18-dag-engine-design.md)

### Task 7: ID Resolution and Reference Handling

**Files:**
- Modify: `aidlc/src/shared/config-loader.js`
- Create: `aidlc/test/shared/id-resolver.spec.js`

**Design Reference:** Section "ID Generation and Resolution" in DAG Engine Design

**Step 1: Write test for ID resolution**

```javascript
// test/shared/id-resolver.spec.js
const ConfigLoader = require('../../src/shared/config-loader');

describe('ID Resolution', () => {
  test('should resolve task reference by name', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend' },
      { id: 'run-tests-7b4e', name: 'Run Tests', needs: ['Build Backend'] }
    ];
    
    const loader = new ConfigLoader();
    const resolved = loader.resolveReferences(tasks);
    
    expect(resolved[1].needs[0]).toBe('build-backend-a3f2');
  });
  
  test('should throw error on ambiguous reference', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend Services' },
      { id: 'build-backend-f9e1', name: 'Build Backend API' },
      { id: 'test-7b4e', name: 'Test', needs: ['Build Backend'] }
    ];
    
    const loader = new ConfigLoader();
    expect(() => loader.resolveReferences(tasks)).toThrow('Ambiguous reference');
  });
});
```

**Step 2-5:** Implement resolution logic, test, and commit

---

### Task 8: YAML Auto-correction

**Files:**
- Modify: `aidlc/src/shared/config-loader.js`
- Create: `aidlc/test/shared/yaml-correction.spec.js`

**Design Reference:** Section "YAML Auto-correction" in DAG Engine Design

Implementation of error annotation and ID persistence in YAML files.

---

### Task 9: Execution Engine with Concurrency Control

**Files:**
- Create: `aidlc/src/services/execution-engine.js`
- Create: `aidlc/test/services/execution-engine.spec.js`

**Design Reference:** Section "Parallel Execution Engine" in DAG Engine Design

**Step 1: Write test for parallel execution**

```javascript
// test/services/execution-engine.spec.js
const ExecutionEngine = require('../../src/services/execution-engine');
const DAGEngine = require('../../src/shared/dag-engine');

describe('ExecutionEngine', () => {
  test('should respect concurrency limit', async () => {
    const engine = new ExecutionEngine(2); // max 2 concurrent
    const tasks = [
      { id: 'task1', name: 'Task 1', needs: [] },
      { id: 'task2', name: 'Task 2', needs: [] },
      { id: 'task3', name: 'Task 3', needs: [] }
    ];
    
    const dagEngine = new DAGEngine();
    const graph = dagEngine.buildGraph(tasks);
    
    let concurrent = 0;
    let maxConcurrent = 0;
    
    const mockExecute = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 100));
      concurrent--;
    };
    
    engine.executeTask = mockExecute;
    await engine.executeDAG(graph, 1);
    
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
```

**Step 2-5:** Implement execution engine, test, and commit

---

### Task 10: File Watching and Hot Reload

**Files:**
- Create: `aidlc/src/services/task-watcher.js`
- Create: `aidlc/test/services/task-watcher.spec.js`

**Design Reference:** Section "Task Loading and Hot Reload" in DAG Engine Design

Implementation of chokidar-based file watching with debounce.

---

## Phase 3: Messaging Platform Implementation

**Reference:** [Messaging Platform Design](./2026-02-18-messaging-platform-design.md)

### Task 11: Messaging Adapter Interface

**Files:**
- Create: `aidlc/src/services/messaging/adapter.js`
- Create: `aidlc/test/services/messaging/adapter.spec.js`

**Design Reference:** Section "Abstract Interface" in Messaging Platform Design

**Step 1: Create abstract adapter class**

```javascript
// src/services/messaging/adapter.js
class MessagingAdapter {
  async sendMessage(chatId, text, options = {}) {
    throw new Error('Not implemented');
  }
  
  async sendTyping(chatId) {
    throw new Error('Not implemented');
  }
  
  async onMessage(handler) {
    throw new Error('Not implemented');
  }
  
  async onButtonClick(handler) {
    throw new Error('Not implemented');
  }
  
  async start() {
    throw new Error('Not implemented');
  }
  
  async stop() {
    throw new Error('Not implemented');
  }
}

module.exports = MessagingAdapter;
```

**Step 2: Write test for adapter contract**

**Step 3-5:** Test and commit

---

### Task 12: Telegram Adapter

**Files:**
- Create: `aidlc/src/services/messaging/telegram-adapter.js`
- Create: `aidlc/test/services/messaging/telegram-adapter.spec.js`

**Design Reference:** Section "Telegram Adapter" in Messaging Platform Design

Complete implementation of Telegram bot with long polling.

---

### Task 13: Slack Adapter

**Files:**
- Create: `aidlc/src/services/messaging/slack-adapter.js`
- Create: `aidlc/test/services/messaging/slack-adapter.spec.js`

**Design Reference:** Section "Slack Adapter" in Messaging Platform Design

Complete implementation of Slack bot with Socket Mode.

---

### Task 14: Messaging Service Core

**Files:**
- Create: `aidlc/src/services/messaging-service.js`
- Create: `aidlc/test/services/messaging-service.spec.js`

**Design Reference:** Section "Messaging Service (Core)" in Messaging Platform Design

**Key Features:**
- Command routing (slash commands vs natural language)
- LLM integration via Kiro CLI
- Context-aware button generation
- Event-based notifications

---

## Phase 4: Integration

### Task 15: Task Manager Service

**Files:**
- Create: `aidlc/src/services/task-manager.js`
- Create: `aidlc/test/services/task-manager.spec.js`

**Responsibilities:**
- Coordinate DAG engine and execution engine
- Manage task lifecycle
- Emit events for messaging service
- Handle retries and timeouts

---

### Task 16: API Routes

**Files:**
- Create: `aidlc/src/routes/tasks.js`
- Create: `aidlc/src/routes/cron.js`
- Create: `aidlc/src/routes/executions.js`
- Create: `aidlc/test/routes/api.spec.js`

**Endpoints:**
- POST /api/cron/trigger
- GET /api/tasks
- POST /api/tasks/execute
- POST /api/tasks/execute-dag
- GET /api/tasks/:id/status
- POST /api/tasks/:id/cancel
- GET /api/executions
- GET /api/executions/:id
- GET /api/executions/:id/logs
- GET /api/reports/daily

---

### Task 17: Docker Compose Setup

**Files:**
- Create: `aidlc/docker-compose.yml`
- Create: `aidlc/Dockerfile`
- Create: `aidlc/crontab`

**Services:**
- aidlc-server (Node.js)
- aidlc-cron (alpine-cron)

**Volumes:**
- ./aidlc:/app
- /storage:/storage
- ~/.kiro:/root/.kiro:ro
- ./data:/data

---

### Task 18: Server Integration

**Files:**
- Modify: `aidlc/src/server.js`

**Integration:**
- Initialize all services
- Register routes
- Setup event listeners
- Configure graceful shutdown

---

## Phase 5: Testing & Deployment

### Task 19: Integration Tests

**Files:**
- Create: `aidlc/test/integration/workflow.spec.js`
- Create: `aidlc/test/integration/api.spec.js`

**Test Scenarios:**
- Complete task execution workflow
- DAG execution with dependencies
- Messaging platform interaction
- Error handling and recovery

---

### Task 20: Documentation and Deployment

**Files:**
- Create: `aidlc/README.md`
- Create: `aidlc/docs/setup.md`
- Create: `aidlc/docs/usage.md`
- Create: `aidlc/config/tasks/example.yaml`

**Documentation:**
- Installation guide
- Configuration reference
- Usage examples
- Troubleshooting

---

## Execution Strategy

**Dependency Order:**
```
Phase 1 (Foundation)
  ↓
Phase 2 (DAG Engine) ←─┐
  ↓                    │
Phase 3 (Messaging) ───┘
  ↓
Phase 4 (Integration)
  ↓
Phase 5 (Testing)
```

**Key Dependencies:**
- Phase 2 and 3 can be developed in parallel after Phase 1
- Phase 4 requires both Phase 2 and 3 complete
- Phase 5 requires all previous phases

**Testing Strategy:**
- Unit tests for each module (TDD approach)
- Integration tests for API endpoints
- End-to-end tests for complete workflows
- Manual testing with real Telegram/Slack bots

**Commit Frequency:**
- After each step (test + implementation)
- Minimum 3-5 commits per task
- Clear, descriptive commit messages

**Design Document Usage:**
- Reference design docs at start of each phase
- Copy code examples from design docs
- Validate implementation against design specs
- Update design docs if implementation reveals issues
