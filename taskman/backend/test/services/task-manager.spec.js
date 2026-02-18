const TaskManager = require('../../src/services/task-manager');
const Database = require('../../src/models/database');
const path = require('path');
const { promises: fs } = require('fs');

describe('TaskManager', () => {
  let manager;
  const testDbPath = path.join(__dirname, '../fixtures/test-manager.db');
  const testConfigDir = path.join(__dirname, '../fixtures/tasks');
  
  beforeEach(async () => {
    await fs.mkdir(path.dirname(testDbPath), { recursive: true }).catch(() => {});
    
    manager = new TaskManager();
    await manager.initialize({
      database: { path: testDbPath },
      tasks: {
        configDir: testConfigDir,
        maxConcurrent: 2
      }
    });
  });
  
  afterEach(async () => {
    await manager.close();
    await fs.unlink(testDbPath).catch(() => {});
  });
  
  describe('initialize', () => {
    test('should load tasks from config directory', () => {
      const tasks = manager.getAllTasks();
      expect(tasks.length).toBeGreaterThan(0);
    });
    
    test('should build task map', () => {
      const tasks = manager.getAllTasks();
      const task = manager.getTask(tasks[0].id);
      expect(task).toBeDefined();
      expect(task.name).toBe(tasks[0].name);
    });
  });
  
  describe('getTask', () => {
    test('should return task by id', () => {
      const tasks = manager.getAllTasks();
      const task = manager.getTask(tasks[0].id);
      expect(task).toBeDefined();
    });
    
    test('should return undefined for non-existent task', () => {
      const task = manager.getTask('non-existent');
      expect(task).toBeUndefined();
    });
  });
  
  describe('executeTask', () => {
    test('should execute task and emit events', async () => {
      const tasks = manager.getAllTasks();
      const taskId = tasks[0].id;
      
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      manager.on('task:started', startedSpy);
      manager.on('task:completed', completedSpy);
      
      // Mock execution to avoid actual command execution
      manager.executionEngine.executeTask = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'success',
        stderr: '',
        duration: 1
      });
      
      const result = await manager.executeTask(taskId);
      
      expect(result.status).toBe('success');
      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          taskName: tasks[0].name
        })
      );
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          taskName: tasks[0].name
        })
      );
    });
    
    test('should handle task failure', async () => {
      const tasks = manager.getAllTasks();
      const taskId = tasks[0].id;
      
      const failedSpy = jest.fn();
      manager.on('task:failed', failedSpy);
      
      manager.executionEngine.executeTask = jest.fn().mockRejectedValue(
        new Error('Task failed')
      );
      
      await expect(manager.executeTask(taskId)).rejects.toThrow('Task failed');
      
      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          error: 'Task failed'
        })
      );
    });
    
    test('should throw error for non-existent task', async () => {
      await expect(manager.executeTask('non-existent')).rejects.toThrow(
        'Task not found: non-existent'
      );
    });
  });
  
  describe('resolveDependencies', () => {
    test('should resolve task dependencies', () => {
      const tasks = manager.getAllTasks();
      const taskWithDeps = tasks.find(t => t.needs && t.needs.length > 0);
      
      if (taskWithDeps) {
        const resolved = manager.resolveDependencies(taskWithDeps.id);
        expect(resolved.length).toBeGreaterThan(1);
        expect(resolved[resolved.length - 1].id).toBe(taskWithDeps.id);
      }
    });
    
    test('should handle task without dependencies', () => {
      const tasks = manager.getAllTasks();
      const taskWithoutDeps = tasks.find(t => !t.needs || t.needs.length === 0);
      
      if (taskWithoutDeps) {
        const resolved = manager.resolveDependencies(taskWithoutDeps.id);
        expect(resolved).toHaveLength(1);
        expect(resolved[0].id).toBe(taskWithoutDeps.id);
      }
    });
  });
  
  describe('getRunningTasks', () => {
    test('should return running tasks', async () => {
      const tasks = manager.getAllTasks();
      const taskId = tasks[0].id;
      
      // Mock long-running task
      manager.executionEngine.executeTask = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ code: 0 }), 100))
      );
      
      const executePromise = manager.executeTask(taskId);
      
      // Check running tasks
      const running = manager.getRunningTasks();
      expect(running.length).toBeGreaterThan(0);
      
      await executePromise;
    });
  });
  
  describe('getExecutionLogs', () => {
    test('should return execution logs', async () => {
      const tasks = manager.getAllTasks();
      const taskId = tasks[0].id;
      
      manager.executionEngine.executeTask = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'test output',
        stderr: '',
        duration: 1
      });
      
      const result = await manager.executeTask(taskId);
      const logs = manager.getExecutionLogs(result.id);
      
      expect(logs).toBeDefined();
      expect(logs.taskId).toBe(taskId);
      expect(logs.stdout).toBe('test output');
    });
    
    test('should throw error for non-existent execution', () => {
      expect(() => manager.getExecutionLogs(99999)).toThrow(
        'Execution not found: 99999'
      );
    });
  });
  
  describe('cancelExecution', () => {
    test('should cancel execution', async () => {
      const tasks = manager.getAllTasks();
      const taskId = tasks[0].id;
      
      manager.executionEngine.executeTask = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '',
        stderr: '',
        duration: 1
      });
      
      const result = await manager.executeTask(taskId);
      
      const cancelledSpy = jest.fn();
      manager.on('task:cancelled', cancelledSpy);
      
      await manager.cancelExecution(result.id);
      
      expect(cancelledSpy).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: result.id })
      );
      
      const execution = manager.getTaskExecution(result.id);
      expect(execution.status).toBe('cancelled');
    });
  });
  
  describe('reloadTasks', () => {
    test('should reload tasks and emit event', async () => {
      const reloadedSpy = jest.fn();
      manager.on('tasks:reloaded', reloadedSpy);
      
      await manager.reloadTasks();
      
      expect(reloadedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ count: expect.any(Number) })
      );
    });
  });
});
