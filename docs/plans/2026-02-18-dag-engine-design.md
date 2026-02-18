# DAG Engine Detailed Design

**Date:** 2026-02-18  
**Component:** DAG Engine  
**Parent Design:** [AIDLC System Design](./2026-02-18-aidlc-design.md)

## Overview

The DAG Engine is responsible for parsing task definitions, resolving dependencies, detecting cycles, and orchestrating parallel task execution with proper dependency management.

## Responsibilities

- Load and parse task definition YAML files
- Generate and validate unique task IDs
- Resolve task references (name → ID)
- Detect circular dependencies
- Perform topological sort for execution order
- Manage parallel execution with concurrency limits
- Handle task failures and retry logic
- Update task definitions in YAML files

## Task Definition Format

### YAML Structure (GitHub Actions Style)

```yaml
tasks:
  - id: build-backend-a3f2  # Auto-generated on first load
    name: "Build Backend Services"
    command: "kiro chat 'Build all backend services'"
    workdir: "/storage/imagine-online"
    timeout: 1800  # seconds
    timeout_action: kill  # kill or warn
    retry: 0  # default: no retry
    retry_delay: 60  # seconds between retries
    continue_on_failure: false  # default
    
  - id: run-tests-7b4e
    name: "Run Tests"
    needs: [build-backend-a3f2]  # GitHub Actions style
    command: "kiro chat 'Run all tests'"
    workdir: "/storage/imagine-online"
    timeout: 600
    if: all_success  # all_success, any_success, always
    
  - id: deploy-staging-c8d1
    name: "Deploy to Staging"
    needs: [build-backend-a3f2, run-tests-7b4e]
    command: "kiro chat 'Deploy to staging'"
    workdir: "/storage/imagine-online"
    timeout: 900
    if: all_success
```

## Task Loading and Hot Reload

### File Watching Strategy

```javascript
const chokidar = require('chokidar');
const debounce = require('lodash.debounce');

// Watch config/tasks/ directory
const watcher = chokidar.watch('config/tasks/**/*.yaml', {
  persistent: true,
  ignoreInitial: false
});

// Debounce reload: wait 60 seconds after last change
const debouncedReload = debounce(async () => {
  await reloadTaskDefinitions();
}, 60000);

watcher.on('change', (path) => {
  logger.info(`Task file changed: ${path}`);
  debouncedReload();
});
```

### Reload Behaviour

- **During Execution:** New definitions loaded, running DAG executions use old snapshot
- **ID Immutability:** Once generated, task IDs cannot be changed
- **Name Changes:** Allowed, ID remains the same
- **Validation:** All tasks validated before reload completes

## ID Generation and Resolution

### ID Generation Algorithm

```javascript
const crypto = require('crypto');

function generateTaskId(name) {
  const slug = slugify(name);  // "Build Backend Services" → "build-backend-services"
  const hex = crypto.randomBytes(2).toString('hex');  // 4 characters
  return `${slug}-${hex}`;  // "build-backend-services-a3f2"
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

### ID Resolution Algorithm

```javascript
function resolveTaskId(reference, allTasks) {
  // 1. If already a complete ID (ends with -XXXX), use as-is
  if (/^[\w-]+-[0-9a-f]{4}$/.test(reference)) {
    const task = allTasks.find(t => t.id === reference);
    if (!task) {
      throw new Error(`Task not found: ${reference}`);
    }
    return reference;
  }
  
  // 2. Slugify the reference
  const slug = slugify(reference);
  
  // 3. Find tasks starting with the slug
  const matches = allTasks.filter(t => t.id.startsWith(slug + '-'));
  
  if (matches.length === 0) {
    // Create new task ID (for new tasks)
    return generateTaskId(reference);
  } else if (matches.length === 1) {
    // Unique match found
    return matches[0].id;
  } else {
    // Ambiguous reference - throw error
    throw new AmbiguousReferenceError(reference, matches);
  }
}
```

### ID Immutability Enforcement

```javascript
async function validateTaskIds(newTasks, existingTasks) {
  const errors = [];
  
  newTasks.forEach(newTask => {
    const existing = existingTasks.find(t => t.id === newTask.id);
    
    if (existing) {
      // ID exists - verify it's the same task (by file path or name)
      // Name changes are allowed, but ID must stay the same
      return;
    }
    
    // Check if user manually changed an ID
    const possibleOriginal = existingTasks.find(t => 
      t.name === newTask.name && t.id !== newTask.id
    );
    
    if (possibleOriginal) {
      errors.push({
        task: newTask,
        error: 'ID_CHANGED',
        originalId: possibleOriginal.id,
        newId: newTask.id
      });
    }
  });
  
  return errors;
}
```

## YAML Auto-correction

### Error Annotation

When errors occur, the system adds comments to the YAML file:

```yaml
tasks:
  - id: build-backend-a3f2
    name: "Build Backend Services"
    
  - id: build-backend-f9e1
    name: "Build Backend API"
    
  - id: run-tests-7b4e
    name: "Run Tests"
    needs:
      - "Build Backend"
      # ❌ ERROR: Ambiguous reference "Build Backend"
      # Multiple matches found:
      #   - build-backend-a3f2 (Build Backend Services)
      #   - build-backend-f9e1 (Build Backend API)
      # Please replace with one of the full IDs above
```

### Auto-correction Process

```javascript
const yaml = require('js-yaml');
const fs = require('fs').promises;

async function autoCorrectYaml(filePath, tasks) {
  // 1. Load original YAML
  const content = await fs.readFile(filePath, 'utf8');
  const data = yaml.load(content);
  
  // 2. Generate IDs for tasks without them
  data.tasks.forEach(task => {
    if (!task.id) {
      task.id = generateTaskId(task.name);
    }
  });
  
  // 3. Resolve references in needs
  data.tasks.forEach(task => {
    if (task.needs) {
      task.needs = task.needs.map(ref => {
        try {
          return resolveTaskId(ref, data.tasks);
        } catch (error) {
          // Add error comment
          return ref;  // Keep original for error annotation
        }
      });
    }
  });
  
  // 4. Write back with comments
  const newContent = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true
  });
  
  await fs.writeFile(filePath, newContent, 'utf8');
}
```

## Dependency Graph Construction

### Graph Data Structure

```javascript
class TaskGraph {
  constructor() {
    this.nodes = new Map();  // taskId → TaskNode
    this.edges = new Map();  // taskId → Set<taskId> (dependencies)
  }
  
  addTask(task) {
    this.nodes.set(task.id, {
      id: task.id,
      name: task.name,
      config: task,
      inDegree: 0,
      dependencies: new Set(),
      dependents: new Set()
    });
  }
  
  addDependency(taskId, dependsOnId) {
    const task = this.nodes.get(taskId);
    const dependency = this.nodes.get(dependsOnId);
    
    if (!task || !dependency) {
      throw new Error(`Task not found: ${taskId} or ${dependsOnId}`);
    }
    
    task.dependencies.add(dependsOnId);
    dependency.dependents.add(taskId);
    task.inDegree++;
  }
}
```

### Cycle Detection (DFS)

```javascript
function detectCycles(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];
  
  function dfs(nodeId, path = []) {
    if (recursionStack.has(nodeId)) {
      // Cycle detected
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat(nodeId);
      cycles.push(cycle);
      return;
    }
    
    if (visited.has(nodeId)) {
      return;
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const node = graph.nodes.get(nodeId);
    node.dependencies.forEach(depId => {
      dfs(depId, [...path]);
    });
    
    recursionStack.delete(nodeId);
  }
  
  // Check all nodes
  graph.nodes.forEach((node, nodeId) => {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  });
  
  return cycles;
}
```

## Topological Sort (Kahn's Algorithm)

```javascript
function topologicalSort(graph) {
  const sorted = [];
  const queue = [];
  const inDegree = new Map();
  
  // Initialize in-degrees
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
  
  // Check if all nodes were processed
  if (sorted.length !== graph.nodes.size) {
    throw new Error('Graph has cycles');
  }
  
  return sorted;
}
```

## Parallel Execution Engine

### Concurrency Control

```javascript
class ExecutionEngine {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = Math.min(Math.max(maxConcurrent, 1), 8);
    this.running = new Map();  // executionId → Promise
    this.completed = new Set();
    this.failed = new Set();
  }
  
  async executeDAG(graph, dagExecutionId) {
    const readyQueue = this.getReadyTasks(graph);
    
    while (readyQueue.length > 0 || this.running.size > 0) {
      // Fill up to max concurrent
      while (readyQueue.length > 0 && this.running.size < this.maxConcurrent) {
        const taskId = readyQueue.shift();
        this.startTask(taskId, graph, dagExecutionId);
      }
      
      // Wait for at least one task to complete
      if (this.running.size > 0) {
        await Promise.race(this.running.values());
      }
      
      // Check for newly ready tasks
      const newReady = this.getReadyTasks(graph);
      readyQueue.push(...newReady);
    }
  }
  
  getReadyTasks(graph) {
    const ready = [];
    
    graph.nodes.forEach((node, taskId) => {
      // Skip if already processed
      if (this.completed.has(taskId) || 
          this.failed.has(taskId) || 
          this.running.has(taskId)) {
        return;
      }
      
      // Check if all dependencies are satisfied
      const depsReady = this.checkDependencies(node, graph);
      if (depsReady) {
        ready.push(taskId);
      }
    });
    
    return ready;
  }
  
  checkDependencies(node, graph) {
    const task = graph.nodes.get(node.id).config;
    const condition = task.if || 'all_success';
    
    let satisfied = true;
    
    node.dependencies.forEach(depId => {
      if (condition === 'all_success') {
        if (!this.completed.has(depId)) {
          satisfied = false;
        }
      } else if (condition === 'any_success') {
        // At least one dependency must be completed
        const anyCompleted = Array.from(node.dependencies)
          .some(id => this.completed.has(id));
        satisfied = anyCompleted;
      } else if (condition === 'always') {
        // Just check if dependency finished (success or failure)
        if (!this.completed.has(depId) && !this.failed.has(depId)) {
          satisfied = false;
        }
      }
    });
    
    return satisfied;
  }
  
  async startTask(taskId, graph, dagExecutionId) {
    const node = graph.nodes.get(taskId);
    const task = node.config;
    
    const promise = this.executeTask(task, dagExecutionId)
      .then(() => {
        this.completed.add(taskId);
        this.running.delete(taskId);
      })
      .catch((error) => {
        if (task.continue_on_failure) {
          this.completed.add(taskId);
        } else {
          this.failed.add(taskId);
        }
        this.running.delete(taskId);
      });
    
    this.running.set(taskId, promise);
  }
  
  async executeTask(task, dagExecutionId) {
    // Delegate to Task Manager
    return taskManager.executeTask(task, dagExecutionId);
  }
}
```

## Retry Logic

```javascript
async function executeWithRetry(task, dagExecutionId) {
  const maxRetries = task.retry || 0;
  const retryDelay = task.retry_delay || 60;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTask(task, dagExecutionId);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        logger.info(`Task ${task.id} failed, retrying in ${retryDelay}s (${attempt + 1}/${maxRetries})`);
        await sleep(retryDelay * 1000);
      }
    }
  }
  
  throw lastError;
}
```

## Timeout Handling

```javascript
async function executeWithTimeout(task, dagExecutionId) {
  const timeout = task.timeout || 1800;
  const action = task.timeout_action || 'kill';
  
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      if (action === 'kill') {
        reject(new TimeoutError(`Task ${task.id} exceeded timeout of ${timeout}s`));
      } else if (action === 'warn') {
        logger.warn(`Task ${task.id} exceeded timeout of ${timeout}s but continuing`);
        resolve({ warning: 'timeout_exceeded' });
      }
    }, timeout * 1000);
  });
  
  return Promise.race([
    executeTask(task, dagExecutionId),
    timeoutPromise
  ]);
}
```

## Configuration

### Environment Variables

```bash
MAX_CONCURRENT_TASKS=3  # 1-8, default: 3
TASK_CONFIG_DIR=./config/tasks
TASK_RELOAD_DEBOUNCE=60000  # ms
```

## Error Handling

### Error Types

```javascript
class AmbiguousReferenceError extends Error {
  constructor(reference, matches) {
    super(`Ambiguous reference: ${reference}`);
    this.reference = reference;
    this.matches = matches;
  }
}

class CircularDependencyError extends Error {
  constructor(cycle) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.cycle = cycle;
  }
}

class TaskNotFoundError extends Error {
  constructor(taskId) {
    super(`Task not found: ${taskId}`);
    this.taskId = taskId;
  }
}

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}
```

## Testing Considerations

- Unit tests for ID generation and resolution
- Cycle detection with various graph structures
- Topological sort correctness
- Concurrency limit enforcement
- Retry logic with mock failures
- Timeout handling (kill vs warn)
- YAML auto-correction
- Hot reload during execution

## Performance Considerations

- File watching with debounce to avoid excessive reloads
- In-memory graph representation for fast lookups
- Efficient topological sort (O(V + E))
- Minimal YAML parsing (only changed files)
- Task definition caching in SQLite

## Future Enhancements

- Task priority levels
- Resource constraints (CPU, memory limits)
- Task groups and namespaces
- Conditional execution based on file changes
- Task output caching
- Distributed execution across multiple workers
