# Workspace Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add workspace switching functionality to taskman backend with chatbot commands and REST API

**Architecture:** Service layer pattern with SQLite storage, integrated with existing messaging service and Kiro CLI wrapper

**Tech Stack:** Node.js, better-sqlite3, Fastify, Jest

---

## Task 1: Database Schema

**Files:**
- Modify: `taskman/backend/src/models/database.js:42-60`

**Step 1: Write the failing test**

Create: `taskman/backend/test/models/database-workspace.spec.js`

```javascript
const DatabaseModel = require('../../src/models/database');
const fs = require('fs').promises;
const path = require('path');

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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/models/database-workspace.spec.js`
Expected: FAIL - workspaces table does not exist

**Step 3: Add workspaces table to database schema**

Modify: `taskman/backend/src/models/database.js`

In the `createTables()` method, add after the settings table:

```javascript
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  name TEXT,
  is_current BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 1
);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/models/database-workspace.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/models/database.js test/models/database-workspace.spec.js
git commit -m "feat(db): add workspaces table schema"
```

---

## Task 2: Workspace Service - Basic Structure

**Files:**
- Create: `taskman/backend/src/services/workspace-service.js`
- Create: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Create: `taskman/backend/test/services/workspace-service.spec.js`

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - WorkspaceService module not found

**Step 3: Create WorkspaceService class**

Create: `taskman/backend/src/services/workspace-service.js`

```javascript
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

class WorkspaceService {
  constructor(db, taskManager) {
    this.db = db;
    this.taskManager = taskManager;
  }
}

module.exports = WorkspaceService;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add WorkspaceService basic structure"
```

---

## Task 3: Path Validation

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - _validatePath is not a function

**Step 3: Implement _validatePath method**

Add to `src/services/workspace-service.js`:

```javascript
_validatePath(dirPath) {
  if (!fs.existsSync(dirPath)) {
    const error = new Error('폴더를 찾을 수 없습니다');
    error.code = 'WORKSPACE_NOT_FOUND';
    throw error;
  }
  
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    const error = new Error('유효한 폴더가 아닙니다');
    error.code = 'WORKSPACE_NOT_DIRECTORY';
    throw error;
  }
  
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add path validation"
```

---

## Task 4: Get Current Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - getCurrentWorkspace is not a function

**Step 3: Implement getCurrentWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
getCurrentWorkspace() {
  const stmt = this.db.db.prepare(`
    SELECT * FROM workspaces WHERE is_current = 1 LIMIT 1
  `);
  const workspace = stmt.get();
  
  if (!workspace) {
    return null;
  }
  
  // Verify path still exists
  try {
    this._validatePath(workspace.path);
    return workspace;
  } catch (error) {
    logger.warn(`Current workspace path no longer exists: ${workspace.path}`);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add getCurrentWorkspace method"
```

---

## Task 5: Get Default Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - getDefaultWorkspace is not a function

**Step 3: Implement getDefaultWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
getDefaultWorkspace() {
  const stmt = this.db.db.prepare(`
    SELECT * FROM workspaces WHERE is_default = 1 LIMIT 1
  `);
  const workspace = stmt.get();
  
  if (!workspace) {
    return null;
  }
  
  // Verify path still exists
  try {
    this._validatePath(workspace.path);
    return workspace;
  } catch (error) {
    logger.warn(`Default workspace path no longer exists: ${workspace.path}`);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add getDefaultWorkspace method"
```

---

## Task 6: Switch Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - switchWorkspace is not a function

**Step 3: Implement switchWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
switchWorkspace(dirPath) {
  // Validate path
  this._validatePath(dirPath);
  
  // Use transaction
  const transaction = this.db.db.transaction(() => {
    // Unset current workspace
    this.db.db.prepare(`
      UPDATE workspaces SET is_current = 0 WHERE is_current = 1
    `).run();
    
    // Check if workspace exists
    const existing = this.db.db.prepare(`
      SELECT * FROM workspaces WHERE path = ?
    `).get(dirPath);
    
    if (existing) {
      // Update existing workspace
      this.db.db.prepare(`
        UPDATE workspaces 
        SET is_current = 1, 
            last_accessed_at = CURRENT_TIMESTAMP,
            access_count = access_count + 1
        WHERE path = ?
      `).run(dirPath);
    } else {
      // Insert new workspace
      this.db.db.prepare(`
        INSERT INTO workspaces (path, is_current, access_count)
        VALUES (?, 1, 1)
      `).run(dirPath);
    }
  });
  
  transaction();
  
  logger.info(`Switched to workspace: ${dirPath}`);
  return this.getCurrentWorkspace();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add switchWorkspace method with transaction"
```

---

## Task 7: Set Default Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('setDefaultWorkspace', () => {
  test('should set default workspace', () => {
    service.setDefaultWorkspace(tempDir);
    
    const defaultWs = service.getDefaultWorkspace();
    expect(defaultWs).toBeDefined();
    expect(defaultWs.path).toBe(tempDir);
  });

  test('should unset previous default workspace', async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
    
    try {
      service.setDefaultWorkspace(dir1);
      service.setDefaultWorkspace(dir2);
      
      const allWorkspaces = db.db.prepare('SELECT * FROM workspaces').all();
      const defaultCount = allWorkspaces.filter(w => w.is_default === 1).length;
      
      expect(defaultCount).toBe(1);
      expect(service.getDefaultWorkspace().path).toBe(dir2);
    } finally {
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
    }
  });

  test('should throw error for non-existent path', () => {
    expect(() => {
      service.setDefaultWorkspace('/non/existent/path');
    }).toThrow('폴더를 찾을 수 없습니다');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - setDefaultWorkspace is not a function

**Step 3: Implement setDefaultWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
setDefaultWorkspace(dirPath) {
  // Validate path
  this._validatePath(dirPath);
  
  // Use transaction
  const transaction = this.db.db.transaction(() => {
    // Unset default workspace
    this.db.db.prepare(`
      UPDATE workspaces SET is_default = 0 WHERE is_default = 1
    `).run();
    
    // Check if workspace exists
    const existing = this.db.db.prepare(`
      SELECT * FROM workspaces WHERE path = ?
    `).get(dirPath);
    
    if (existing) {
      // Update existing workspace
      this.db.db.prepare(`
        UPDATE workspaces SET is_default = 1 WHERE path = ?
      `).run(dirPath);
    } else {
      // Insert new workspace
      this.db.db.prepare(`
        INSERT INTO workspaces (path, is_default) VALUES (?, 1)
      `).run(dirPath);
    }
  });
  
  transaction();
  
  logger.info(`Set default workspace: ${dirPath}`);
  return this.getDefaultWorkspace();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add setDefaultWorkspace method"
```

---

## Task 8: Switch to Default

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('switchToDefault', () => {
  test('should switch to default workspace', () => {
    service.setDefaultWorkspace(tempDir);
    service.switchToDefault();
    
    const current = service.getCurrentWorkspace();
    expect(current).toBeDefined();
    expect(current.path).toBe(tempDir);
  });

  test('should throw error when no default workspace', () => {
    expect(() => {
      service.switchToDefault();
    }).toThrow('디폴트 워크스페이스가 설정되지 않았습니다');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - switchToDefault is not a function

**Step 3: Implement switchToDefault method**

Add to `src/services/workspace-service.js`:

```javascript
switchToDefault() {
  const defaultWs = this.getDefaultWorkspace();
  
  if (!defaultWs) {
    const error = new Error('디폴트 워크스페이스가 설정되지 않았습니다');
    error.code = 'NO_DEFAULT_WORKSPACE';
    throw error;
  }
  
  return this.switchWorkspace(defaultWs.path);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add switchToDefault method"
```

---

## Task 9: List Workspaces

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('listWorkspaces', () => {
  test('should return empty array when no workspaces', () => {
    const result = service.listWorkspaces();
    expect(result).toEqual([]);
  });

  test('should return workspaces ordered by last_accessed_at', async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
    const dir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws3-'));
    
    try {
      service.switchWorkspace(dir1);
      service.switchWorkspace(dir2);
      service.switchWorkspace(dir3);
      
      const result = service.listWorkspaces();
      expect(result).toHaveLength(3);
      expect(result[0].path).toBe(dir3); // Most recent
      expect(result[2].path).toBe(dir1); // Oldest
    } finally {
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
      await fs.rm(dir3, { recursive: true, force: true });
    }
  });

  test('should respect limit parameter', async () => {
    const dir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws1-'));
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws2-'));
    const dir3 = await fs.mkdtemp(path.join(os.tmpdir(), 'ws3-'));
    
    try {
      service.switchWorkspace(dir1);
      service.switchWorkspace(dir2);
      service.switchWorkspace(dir3);
      
      const result = service.listWorkspaces(2);
      expect(result).toHaveLength(2);
    } finally {
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
      await fs.rm(dir3, { recursive: true, force: true });
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - listWorkspaces is not a function

**Step 3: Implement listWorkspaces method**

Add to `src/services/workspace-service.js`:

```javascript
listWorkspaces(limit = 10) {
  const stmt = this.db.db.prepare(`
    SELECT * FROM workspaces 
    ORDER BY last_accessed_at DESC 
    LIMIT ?
  `);
  
  return stmt.all(limit);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add listWorkspaces method"
```

---

## Task 10: Find Existing Task Workdir

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('_findExistingTaskWorkdir', () => {
  beforeEach(() => {
    // Mock taskManager
    service.taskManager = {
      getAllTasks: jest.fn()
    };
  });

  test('should return null when no tasks', () => {
    service.taskManager.getAllTasks.mockReturnValue([]);
    
    const result = service._findExistingTaskWorkdir();
    expect(result).toBeNull();
  });

  test('should return first existing workdir', async () => {
    const existingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'existing-'));
    
    try {
      service.taskManager.getAllTasks.mockReturnValue([
        { workdir: '/non/existent/path' },
        { workdir: existingDir },
        { workdir: tempDir }
      ]);
      
      const result = service._findExistingTaskWorkdir();
      expect(result).toBe(existingDir);
    } finally {
      await fs.rm(existingDir, { recursive: true, force: true });
    }
  });

  test('should return null when all workdirs do not exist', () => {
    service.taskManager.getAllTasks.mockReturnValue([
      { workdir: '/non/existent/path1' },
      { workdir: '/non/existent/path2' }
    ]);
    
    const result = service._findExistingTaskWorkdir();
    expect(result).toBeNull();
  });

  test('should handle tasks without workdir', () => {
    service.taskManager.getAllTasks.mockReturnValue([
      { workdir: null },
      { workdir: undefined },
      { workdir: tempDir }
    ]);
    
    const result = service._findExistingTaskWorkdir();
    expect(result).toBe(tempDir);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - _findExistingTaskWorkdir is not a function

**Step 3: Implement _findExistingTaskWorkdir method**

Add to `src/services/workspace-service.js`:

```javascript
_findExistingTaskWorkdir() {
  if (!this.taskManager) {
    return null;
  }
  
  const tasks = this.taskManager.getAllTasks();
  
  for (const task of tasks) {
    if (!task.workdir) {
      continue;
    }
    
    try {
      if (fs.existsSync(task.workdir) && fs.statSync(task.workdir).isDirectory()) {
        return task.workdir;
      }
    } catch (error) {
      // Skip invalid paths
      continue;
    }
  }
  
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add _findExistingTaskWorkdir helper"
```

---

## Task 11: Ensure Default Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('ensureDefaultWorkspace', () => {
  beforeEach(() => {
    service.taskManager = {
      getAllTasks: jest.fn().mockReturnValue([])
    };
  });

  test('should not change existing default workspace', () => {
    service.setDefaultWorkspace(tempDir);
    service.ensureDefaultWorkspace();
    
    const defaultWs = service.getDefaultWorkspace();
    expect(defaultWs.path).toBe(tempDir);
  });

  test('should set current as default if no default exists', async () => {
    const currentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'current-'));
    
    try {
      service.switchWorkspace(currentDir);
      service.ensureDefaultWorkspace();
      
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs.path).toBe(currentDir);
    } finally {
      await fs.rm(currentDir, { recursive: true, force: true });
    }
  });

  test('should use task workdir if no current or default', async () => {
    const taskDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-'));
    
    try {
      service.taskManager.getAllTasks.mockReturnValue([
        { workdir: taskDir }
      ]);
      
      service.ensureDefaultWorkspace();
      
      const defaultWs = service.getDefaultWorkspace();
      expect(defaultWs.path).toBe(taskDir);
    } finally {
      await fs.rm(taskDir, { recursive: true, force: true });
    }
  });

  test('should use process.cwd() as last resort', () => {
    service.ensureDefaultWorkspace();
    
    const defaultWs = service.getDefaultWorkspace();
    expect(defaultWs.path).toBe(process.cwd());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - ensureDefaultWorkspace is not a function

**Step 3: Implement ensureDefaultWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
ensureDefaultWorkspace() {
  // Check if default exists and is valid
  const defaultWs = this.getDefaultWorkspace();
  if (defaultWs) {
    logger.debug('Default workspace already exists');
    return defaultWs;
  }
  
  logger.info('No default workspace found, initializing...');
  
  // Try current workspace
  const currentWs = this.getCurrentWorkspace();
  if (currentWs) {
    logger.info(`Setting current workspace as default: ${currentWs.path}`);
    this.setDefaultWorkspace(currentWs.path);
    return this.getDefaultWorkspace();
  }
  
  // Try task workdir
  const taskWorkdir = this._findExistingTaskWorkdir();
  if (taskWorkdir) {
    logger.info(`Setting task workdir as default: ${taskWorkdir}`);
    this.setDefaultWorkspace(taskWorkdir);
    return this.getDefaultWorkspace();
  }
  
  // Use process.cwd() as last resort
  const cwd = process.cwd();
  logger.info(`Setting process.cwd() as default: ${cwd}`);
  this.setDefaultWorkspace(cwd);
  return this.getDefaultWorkspace();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add ensureDefaultWorkspace initialization"
```

---

## Task 12: Get Workdir for Kiro

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('getWorkdirForKiro', () => {
  beforeEach(() => {
    service.taskManager = {
      getAllTasks: jest.fn().mockReturnValue([])
    };
  });

  test('should return current workspace if exists', () => {
    service.switchWorkspace(tempDir);
    
    const workdir = service.getWorkdirForKiro();
    expect(workdir).toBe(tempDir);
  });

  test('should return default workspace if no current', () => {
    service.setDefaultWorkspace(tempDir);
    
    const workdir = service.getWorkdirForKiro();
    expect(workdir).toBe(tempDir);
  });

  test('should call ensureDefaultWorkspace if both missing', () => {
    const workdir = service.getWorkdirForKiro();
    expect(workdir).toBe(process.cwd());
    
    // Verify default was set
    const defaultWs = service.getDefaultWorkspace();
    expect(defaultWs).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - getWorkdirForKiro is not a function

**Step 3: Implement getWorkdirForKiro method**

Add to `src/services/workspace-service.js`:

```javascript
getWorkdirForKiro() {
  // Try current workspace
  const currentWs = this.getCurrentWorkspace();
  if (currentWs) {
    return currentWs.path;
  }
  
  // Try default workspace
  const defaultWs = this.getDefaultWorkspace();
  if (defaultWs) {
    return defaultWs.path;
  }
  
  // Ensure default exists and return it
  const ensuredDefault = this.ensureDefaultWorkspace();
  return ensuredDefault.path;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add getWorkdirForKiro method"
```

---

## Task 13: Delete Workspace

**Files:**
- Modify: `taskman/backend/src/services/workspace-service.js`
- Modify: `taskman/backend/test/services/workspace-service.spec.js`

**Step 1: Write the failing test**

Add to `test/services/workspace-service.spec.js`:

```javascript
describe('deleteWorkspace', () => {
  test('should delete workspace by id', () => {
    service.switchWorkspace(tempDir);
    const workspace = service.getCurrentWorkspace();
    
    service.deleteWorkspace(workspace.id);
    
    const result = db.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace.id);
    expect(result).toBeUndefined();
  });

  test('should not throw error for non-existent id', () => {
    expect(() => {
      service.deleteWorkspace(99999);
    }).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: FAIL - deleteWorkspace is not a function

**Step 3: Implement deleteWorkspace method**

Add to `src/services/workspace-service.js`:

```javascript
deleteWorkspace(id) {
  const stmt = this.db.db.prepare(`
    DELETE FROM workspaces WHERE id = ?
  `);
  
  stmt.run(id);
  logger.info(`Deleted workspace: ${id}`);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/workspace-service.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/workspace-service.js test/services/workspace-service.spec.js
git commit -m "feat(workspace): add deleteWorkspace method"
```

---

## Task 14: Workspace Routes

**Files:**
- Create: `taskman/backend/src/routes/workspace.js`
- Create: `taskman/backend/test/routes/workspace.spec.js`

**Step 1: Write the failing test**

Create: `taskman/backend/test/routes/workspace.spec.js`

```javascript
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/routes/workspace.spec.js`
Expected: FAIL - workspace routes module not found

**Step 3: Create workspace routes**

Create: `taskman/backend/src/routes/workspace.js`

```javascript
async function workspaceRoutes(fastify, options) {
  const service = fastify.workspaceService;

  // GET /api/workspace - Get current workspace
  fastify.get('/api/workspace', async (request, reply) => {
    const workspace = service.getCurrentWorkspace();
    
    if (!workspace) {
      return reply.code(404).send({
        error: 'No current workspace'
      });
    }
    
    return workspace;
  });

  // POST /api/workspace/switch - Switch workspace
  fastify.post('/api/workspace/switch', async (request, reply) => {
    const { path } = request.body;
    
    if (!path) {
      return reply.code(400).send({
        error: 'Path is required'
      });
    }
    
    try {
      const workspace = service.switchWorkspace(path);
      return {
        success: true,
        workspace
      };
    } catch (error) {
      return reply.code(400).send({
        error: error.message,
        code: error.code
      });
    }
  });

  // POST /api/workspace/default - Set default workspace
  fastify.post('/api/workspace/default', async (request, reply) => {
    const { path } = request.body;
    
    if (!path) {
      return reply.code(400).send({
        error: 'Path is required'
      });
    }
    
    try {
      service.setDefaultWorkspace(path);
      return { success: true };
    } catch (error) {
      return reply.code(400).send({
        error: error.message,
        code: error.code
      });
    }
  });

  // GET /api/workspace/default - Get default workspace
  fastify.get('/api/workspace/default', async (request, reply) => {
    const workspace = service.getDefaultWorkspace();
    
    if (!workspace) {
      return reply.code(404).send({
        error: 'No default workspace'
      });
    }
    
    return workspace;
  });

  // GET /api/workspace/list - List workspaces
  fastify.get('/api/workspace/list', async (request, reply) => {
    const { limit = 10 } = request.query;
    const workspaces = service.listWorkspaces(parseInt(limit));
    
    return {
      workspaces,
      total: workspaces.length
    };
  });

  // DELETE /api/workspace/:id - Delete workspace
  fastify.delete('/api/workspace/:id', async (request, reply) => {
    const { id } = request.params;
    
    service.deleteWorkspace(parseInt(id));
    
    return { success: true };
  });
}

module.exports = workspaceRoutes;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/routes/workspace.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/workspace.js test/routes/workspace.spec.js
git commit -m "feat(workspace): add REST API routes"
```

---

## Task 15: Integrate with Kiro Wrapper

**Files:**
- Modify: `taskman/backend/src/services/kiro-wrapper.js`
- Create: `taskman/backend/test/services/kiro-wrapper-workspace.spec.js`

**Step 1: Write the failing test**

Create: `taskman/backend/test/services/kiro-wrapper-workspace.spec.js`

```javascript
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

  test('should use current workspace for kiro-cli', () => {
    workspaceService.switchWorkspace(tempDir);
    
    // Mock executeCommand to capture workdir
    let capturedWorkdir;
    kiroWrapper.executeCommand = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(tempDir);
  });

  test('should use default workspace when no current', () => {
    workspaceService.setDefaultWorkspace(tempDir);
    
    let capturedWorkdir;
    kiroWrapper.executeCommand = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(tempDir);
  });

  test('should use process.cwd() when no workspace configured', () => {
    let capturedWorkdir;
    kiroWrapper.executeCommand = jest.fn(({ workdir }) => {
      capturedWorkdir = workdir;
      return Promise.resolve({ code: 0, stdout: 'test', stderr: '' });
    });
    
    kiroWrapper.chat('test message');
    
    expect(capturedWorkdir).toBe(process.cwd());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/services/kiro-wrapper-workspace.spec.js`
Expected: FAIL - KiroWrapper constructor doesn't accept workspaceService

**Step 3: Modify KiroWrapper to use workspace service**

Modify: `taskman/backend/src/services/kiro-wrapper.js`

Change constructor:

```javascript
class KiroWrapper {
  constructor(workspaceService = null) {
    this.workspaceService = workspaceService;
  }
  
  // ... existing methods
}
```

Modify the `chat` method to use workspace:

```javascript
async chat(message, context = {}) {
  logger.debug(`kiro-wrapper/chat:: Received message: ${message}`);
  logger.debug(`kiro-wrapper/chat:: Context: ${JSON.stringify(context, null, 2)}`);
  
  // Determine workdir from workspace service
  let workdir = process.cwd();
  if (this.workspaceService) {
    workdir = this.workspaceService.getWorkdirForKiro();
    logger.debug(`kiro-wrapper/chat:: Using workspace: ${workdir}`);
  }
  
  // Build context string for Kiro
  const contextStr = JSON.stringify(context, null, 2);
  
  // Create a prompt with context
  const fullPrompt = `You are a task management assistant. Help the user with their request based on the following context.

Context:
${contextStr}

User message: ${message}

Instructions:
- If the user clearly wants to execute a task (e.g., "run X", "execute X", "X 실행해줘", "X 돌려줘"), respond with ONLY this JSON format:
  {"action": "execute", "task_id": "task-id-here"}
  
- If the user asks about task status, list, or information, provide a helpful response in Korean.

- If the user's intent is unclear, ask for clarification in Korean.

Respond in Korean for explanations, but use the JSON format for execution requests.`;
  
  // Escape quotes in prompt
  const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
  
  try {
    logger.debug('kiro-wrapper/chat:: Calling kiro-cli...');
    
    const result = await this.executeCommand({
      command: `kiro-cli chat --no-interactive --trust-all-tools '${escapedPrompt}'`,
      workdir: workdir,  // Use workspace workdir
      timeout: 60
    });
    
    if (result.code === 0) {
      const cleanOutput = stripAnsi(result.stdout.trim());
      logger.debug(`kiro-wrapper/chat:: Response: ${cleanOutput}`);
      return cleanOutput;
    } else {
      logger.error(`kiro-wrapper/chat:: Kiro CLI failed with stderr: ${result.stderr}`);
      throw new Error(result.stderr || 'Kiro CLI failed');
    }
  } catch (error) {
    logger.error(`kiro-wrapper/chat:: Error: ${error?.message}`);
    throw new Error(`Kiro CLI error: ${error?.message}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/services/kiro-wrapper-workspace.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/kiro-wrapper.js test/services/kiro-wrapper-workspace.spec.js
git commit -m "feat(kiro): integrate workspace service with Kiro CLI"
```

---

## Task 16: Add Workspace Commands to Messaging Service

**Files:**
- Modify: `taskman/backend/src/services/messaging-service.js`

**Step 1: Add workspace command handler**

Modify: `taskman/backend/src/services/messaging-service.js`

In the `handleCommand` method, add workspace case:

```javascript
async handleCommand(chatId, text) {
  const [command, ...args] = text.split(' ');
  const cmd = command.replace(/^[!/]/, ''); // Remove ! or / prefix
  
  try {
    switch (cmd) {
      case 'status':
        return await this.cmdStatus(chatId);
      case 'list':
        return await this.cmdList(chatId);
      case 'run':
        return await this.cmdRun(chatId, args[0]);
      case 'cancel':
        return await this.cmdCancel(chatId, args[0]);
      case 'logs':
        return await this.cmdLogs(chatId, args[0]);
      case 'report':
        return await this.cmdReport(chatId);
      case 'workspace':
        return await this.cmdWorkspace(chatId, args);
      case 'help':
        return await this.cmdHelp(chatId);
      default:
        const prefix = this.platform === 'slack' ? '!' : '/';
        return await this.adapter.sendMessage(
          chatId,
          `❓ Unknown command. Type ${prefix}help for available commands.`
        );
    }
  } catch (error) {
    await this.adapter.sendMessage(
      chatId,
      `❌ Error: ${error?.message}`
    );
  }
}
```

**Step 2: Implement cmdWorkspace method**

Add to `src/services/messaging-service.js`:

```javascript
async cmdWorkspace(chatId, args) {
  if (!this.workspaceService) {
    return await this.adapter.sendMessage(
      chatId,
      '❌ Workspace service not available'
    );
  }
  
  // !workspace (show current)
  if (args.length === 0) {
    const current = this.workspaceService.getCurrentWorkspace();
    if (!current) {
      return await this.adapter.sendMessage(
        chatId,
        '📂 현재 워크스페이스가 설정되지 않았습니다'
      );
    }
    return await this.adapter.sendMessage(
      chatId,
      `📂 현재 워크스페이스: ${current.path}\n접근 횟수: ${current.access_count}`
    );
  }
  
  // !workspace list
  if (args[0] === 'list') {
    const workspaces = this.workspaceService.listWorkspaces(5);
    if (workspaces.length === 0) {
      return await this.adapter.sendMessage(
        chatId,
        '📂 워크스페이스 히스토리가 없습니다'
      );
    }
    
    const list = workspaces.map((ws, idx) => {
      const current = ws.is_current ? '✓ ' : '  ';
      const defaultMark = ws.is_default ? '⭐ ' : '';
      return `${idx + 1}. ${current}${defaultMark}${ws.path} (${ws.access_count}회)`;
    }).join('\n');
    
    return await this.adapter.sendMessage(
      chatId,
      `📂 최근 워크스페이스:\n${list}`
    );
  }
  
  // !workspace default (switch to default)
  if (args[0] === 'default' && args.length === 1) {
    try {
      const workspace = this.workspaceService.switchToDefault();
      return await this.adapter.sendMessage(
        chatId,
        `✅ 디폴트 워크스페이스로 전환: ${workspace.path}`
      );
    } catch (error) {
      return await this.adapter.sendMessage(
        chatId,
        `❌ ${error.message}`
      );
    }
  }
  
  // !workspace default <path> (set default)
  if (args[0] === 'default' && args.length > 1) {
    const path = args.slice(1).join(' ');
    try {
      this.workspaceService.setDefaultWorkspace(path);
      return await this.adapter.sendMessage(
        chatId,
        `✅ 디폴트 워크스페이스 설정: ${path}`
      );
    } catch (error) {
      return await this.adapter.sendMessage(
        chatId,
        `❌ ${error.message}`
      );
    }
  }
  
  // !workspace <path> (switch)
  const path = args.join(' ');
  try {
    const workspace = this.workspaceService.switchWorkspace(path);
    return await this.adapter.sendMessage(
      chatId,
      `✅ 워크스페이스 전환: ${workspace.path}`
    );
  } catch (error) {
    return await this.adapter.sendMessage(
      chatId,
      `❌ ${error.message}`
    );
  }
}
```

**Step 3: Update help command**

Modify the `cmdHelp` method to include workspace commands:

```javascript
async cmdHelp(chatId) {
  const prefix = this.platform === 'slack' ? '!' : '/';
  const help = `
📋 TaskMan Commands

${prefix}status - Show running tasks
${prefix}list - List all available tasks
${prefix}run <task-id> - Execute a task
${prefix}cancel <execution-id> - Cancel running task
${prefix}logs <execution-id> - View task logs
${prefix}report - Generate daily report
${prefix}workspace - Show current workspace
${prefix}workspace <path> - Switch workspace
${prefix}workspace list - List recent workspaces
${prefix}workspace default - Switch to default workspace
${prefix}workspace default <path> - Set default workspace
${prefix}help - Show this help message

You can also use natural language:
"빌드 상태 알려줘"
"백엔드 빌드 돌려줘"
"로그 보여줘"
  `.trim();
  
  await this.adapter.sendMessage(chatId, help);
}
```

**Step 4: Add workspaceService property**

Add to the constructor or initialization:

```javascript
constructor() {
  this.adapter = null;
  this.platform = null;
  this.messageHandler = null;
  this.buttonHandler = null;
  this.workspaceService = null;  // Add this
}

// Add setter method
setWorkspaceService(workspaceService) {
  this.workspaceService = workspaceService;
}
```

**Step 5: Commit**

```bash
git add src/services/messaging-service.js
git commit -m "feat(messaging): add workspace commands to chatbot"
```

---

## Task 17: Wire Everything Together in Server

**Files:**
- Modify: `taskman/backend/src/server.js`

**Step 1: Import and initialize workspace service**

Modify: `taskman/backend/src/server.js`

Add imports:

```javascript
const WorkspaceService = require('./services/workspace-service');
const workspaceRoutes = require('./routes/workspace');
```

Initialize workspace service after database:

```javascript
// Initialize database
const db = new DatabaseModel(config.database.path);
await db.initialize();
logger.info('Database initialized');

// Initialize workspace service
const workspaceService = new WorkspaceService(db, taskManager);
workspaceService.ensureDefaultWorkspace();
logger.info('Workspace service initialized');
```

**Step 2: Register workspace routes**

Add after other routes:

```javascript
// Decorate fastify with workspace service
fastify.decorate('workspaceService', workspaceService);

// Register routes
fastify.register(taskRoutes);
fastify.register(executionRoutes);
fastify.register(reportRoutes);
fastify.register(cronRoutes);
fastify.register(workspaceRoutes);  // Add this
```

**Step 3: Pass workspace service to messaging and kiro wrapper**

Modify messaging service initialization:

```javascript
// Initialize messaging service
const messagingService = new MessagingService();
messagingService.setWorkspaceService(workspaceService);
await messagingService.initialize(config.messaging);
```

Modify kiro wrapper initialization:

```javascript
// Initialize Kiro wrapper
const kiroWrapper = new KiroWrapper(workspaceService);
```

**Step 4: Commit**

```bash
git add src/server.js
git commit -m "feat(server): wire workspace service into application"
```

---

## Task 18: Update README

**Files:**
- Modify: `taskman/backend/README.md`

**Step 1: Add workspace section to README**

Add after the "Telegram Bot Setup" section:

```markdown
## Workspace Management

TaskMan supports workspace switching to manage multiple project directories.

### Commands

**Chatbot:**
- `!workspace` - Show current workspace
- `!workspace <path>` - Switch to workspace
- `!workspace list` - List recent workspaces
- `!workspace default` - Switch to default workspace
- `!workspace default <path>` - Set default workspace

**API:**
- `GET /api/workspace` - Get current workspace
- `POST /api/workspace/switch` - Switch workspace
- `POST /api/workspace/default` - Set default workspace
- `GET /api/workspace/default` - Get default workspace
- `GET /api/workspace/list` - List workspaces
- `DELETE /api/workspace/:id` - Delete workspace history

### How It Works

- Current workspace is used for Kiro CLI execution
- Default workspace is automatically set on first run
- Workspace history tracks access count and last accessed time
- Task workdir is independent of workspace settings
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add workspace management documentation"
```

---

## Task 19: Run All Tests

**Step 1: Run complete test suite**

Run: `npm test`
Expected: All tests PASS

**Step 2: Check test coverage**

Run: `npm test -- --coverage`
Expected: Good coverage for workspace-related code

**Step 3: Fix any failing tests**

If any tests fail, fix them before proceeding.

**Step 4: Commit if fixes were needed**

```bash
git add .
git commit -m "test: fix failing tests"
```

---

## Task 20: Manual Testing

**Step 1: Start the server**

Run: `npm start`

**Step 2: Test API endpoints**

```bash
# Get current workspace (should be auto-initialized)
curl http://localhost:8254/api/workspace

# Switch workspace
curl -X POST http://localhost:8254/api/workspace/switch \
  -H "Content-Type: application/json" \
  -d '{"path": "/tmp"}'

# List workspaces
curl http://localhost:8254/api/workspace/list

# Set default
curl -X POST http://localhost:8254/api/workspace/default \
  -H "Content-Type: application/json" \
  -d '{"path": "/tmp"}'

# Get default
curl http://localhost:8254/api/workspace/default
```

**Step 3: Test chatbot commands**

Send messages to your Telegram/Slack bot:
- `!workspace`
- `!workspace /tmp`
- `!workspace list`
- `!workspace default`
- `!workspace default /tmp`

**Step 4: Verify Kiro CLI uses workspace**

Check logs to confirm Kiro CLI is executed in the correct workspace directory.

**Step 5: Document any issues**

If issues are found, create tickets or fix them immediately.

---

## Final Commit

```bash
git add .
git commit -m "feat(workspace): complete workspace switcher implementation"
git push origin HEAD
```

---

## Summary

This implementation adds complete workspace switching functionality to taskman:

- SQLite database schema for workspace storage
- WorkspaceService with full CRUD operations
- REST API endpoints for programmatic access
- Chatbot commands for user-friendly interaction
- Integration with Kiro CLI for workspace-aware execution
- Automatic default workspace initialization
- Comprehensive test coverage

The feature is production-ready and follows TDD principles throughout.
