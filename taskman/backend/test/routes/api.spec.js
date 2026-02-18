const fastify = require('fastify');
const tasksRoutes = require('../../src/routes/tasks');
const executionsRoutes = require('../../src/routes/executions');
const cronRoutes = require('../../src/routes/cron');
const reportsRoutes = require('../../src/routes/reports');

describe('API Routes', () => {
  let app;
  let mockTaskManager;
  
  beforeEach(async () => {
    // Create mock task manager
    mockTaskManager = {
      getAllTasks: jest.fn().mockReturnValue([
        { id: 'task-1', name: 'Task 1', command: 'echo 1' },
        { id: 'task-2', name: 'Task 2', command: 'echo 2', needs: ['task-1'] }
      ]),
      getTask: jest.fn((id) => {
        if (id === 'task-1') {
          return { id: 'task-1', name: 'Task 1', command: 'echo 1' };
        }
        return null;
      }),
      executeTask: jest.fn().mockResolvedValue({ id: 1, status: 'success' }),
      executeDAG: jest.fn().mockResolvedValue({ id: 1, status: 'success' }),
      getRunningTasks: jest.fn().mockReturnValue([]),
      cancelExecution: jest.fn().mockResolvedValue(undefined),
      reloadTasks: jest.fn().mockResolvedValue(undefined),
      getTaskExecution: jest.fn((id) => {
        if (id === 1) {
          return {
            id: 1,
            task_id: 'task-1',
            task_name: 'Task 1',
            status: 'success',
            started_at: '2026-02-18T10:00:00Z',
            completed_at: '2026-02-18T10:01:00Z',
            duration: 60
          };
        }
        return null;
      }),
      getExecutionLogs: jest.fn((id) => {
        if (id === 1) {
          return {
            id: 1,
            taskId: 'task-1',
            taskName: 'Task 1',
            status: 'success',
            stdout: 'output',
            stderr: ''
          };
        }
        throw new Error(`Execution not found: ${id}`);
      }),
      getExecutionsByDate: jest.fn().mockReturnValue([
        {
          id: 1,
          task_id: 'task-1',
          task_name: 'Task 1',
          status: 'success',
          started_at: '2026-02-18T10:00:00Z',
          completed_at: '2026-02-18T10:01:00Z',
          duration: 60
        }
      ])
    };
    
    // Create Fastify app
    app = fastify();
    app.decorate('taskManager', mockTaskManager);
    
    // Register routes
    await app.register(tasksRoutes);
    await app.register(executionsRoutes);
    await app.register(cronRoutes);
    await app.register(reportsRoutes);
    
    await app.ready();
  });
  
  afterEach(async () => {
    await app.close();
  });
  
  describe('Tasks Routes', () => {
    test('GET /api/tasks should return all tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.tasks).toHaveLength(2);
    });
    
    test('GET /api/tasks/:id should return task details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/task-1'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.task).toBeDefined();
      expect(data.task.id).toBe('task-1');
    });
    
    test('GET /api/tasks/:id should return 404 for non-existent task', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/non-existent'
      });
      
      expect(response.statusCode).toBe(404);
    });
    
    test('POST /api/tasks/execute should execute task', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/execute',
        payload: { taskId: 'task-1' }
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.executionId).toBe(1);
      expect(mockTaskManager.executeTask).toHaveBeenCalledWith('task-1', 'api');
    });
    
    test('POST /api/tasks/execute-dag should execute DAG', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/execute-dag',
        payload: { taskId: 'task-2' }
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.dagExecutionId).toBe(1);
      expect(mockTaskManager.executeDAG).toHaveBeenCalledWith('task-2', 'api');
    });
    
    test('GET /api/tasks/:id/status should return running tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/task-1/status'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.running).toEqual([]);
    });
    
    test('POST /api/tasks/:id/cancel should cancel execution', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/1/cancel'
      });
      
      expect(response.statusCode).toBe(200);
      expect(mockTaskManager.cancelExecution).toHaveBeenCalledWith(1);
    });
    
    test('POST /api/tasks/reload should reload tasks', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/reload'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.count).toBe(2);
      expect(mockTaskManager.reloadTasks).toHaveBeenCalled();
    });
  });
  
  describe('Executions Routes', () => {
    test('GET /api/executions should return executions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/executions'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.executions).toHaveLength(1);
    });
    
    test('GET /api/executions/:id should return execution details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/executions/1'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.execution.id).toBe(1);
    });
    
    test('GET /api/executions/:id should return 404 for non-existent execution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/executions/999'
      });
      
      expect(response.statusCode).toBe(404);
    });
    
    test('GET /api/executions/:id/logs should return logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/executions/1/logs'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.logs.stdout).toBe('output');
    });
    
    test('GET /api/executions/:id/logs should return 404 for non-existent execution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/executions/999/logs'
      });
      
      expect(response.statusCode).toBe(404);
    });
  });
  
  describe('Cron Routes', () => {
    test('POST /api/cron/trigger should trigger task', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/trigger',
        payload: { taskId: 'task-1' }
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.executionId).toBe(1);
      expect(mockTaskManager.executeTask).toHaveBeenCalledWith('task-1', 'cron');
    });
    
    test('POST /api/cron/trigger should trigger DAG when executeDAG is true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/trigger',
        payload: { taskId: 'task-2', executeDAG: true }
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.executionId).toBe(1);
      expect(mockTaskManager.executeDAG).toHaveBeenCalledWith('task-2', 'cron');
    });
  });
  
  describe('Reports Routes', () => {
    test('GET /api/reports/daily should return daily report', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reports/daily'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.total).toBe(1);
      expect(data.success).toBe(1);
      expect(data.failed).toBe(0);
    });
    
    test('GET /api/reports/summary should return summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reports/summary'
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.today.total).toBe(1);
      expect(data.running).toEqual([]);
    });
  });
});
