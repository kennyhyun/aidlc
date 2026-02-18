async function tasksRoutes(fastify) {
  const { taskManager } = fastify;
  
  // GET /api/tasks - List all tasks
  fastify.get('/api/tasks', {
    schema: {
      description: 'List all available tasks',
      tags: ['tasks']
    }
  }, async (request, reply) => {
    const tasks = taskManager.getAllTasks();
    return { tasks };
  });
  
  // GET /api/tasks/:id - Get task details
  fastify.get('/api/tasks/:id', {
    schema: {
      description: 'Get task details by ID',
      tags: ['tasks']
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const task = taskManager.getTask(id);
    
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${id}` };
    }
    
    return { task };
  });
  
  // POST /api/tasks/execute - Execute a single task
  fastify.post('/api/tasks/execute', {
    schema: {
      description: 'Execute a single task',
      tags: ['tasks'],
      body: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          triggeredBy: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { taskId, triggeredBy = 'api' } = request.body;
    
    try {
      const result = await taskManager.executeTask(taskId, triggeredBy);
      return { executionId: result.id, status: result.status };
    } catch (error) {
      reply.code(400);
      return { error: error?.message };
    }
  });
  
  // POST /api/tasks/execute-dag - Execute DAG
  fastify.post('/api/tasks/execute-dag', {
    schema: {
      description: 'Execute a task with its dependencies (DAG)',
      tags: ['tasks'],
      body: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          triggeredBy: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { taskId, triggeredBy = 'api' } = request.body;
    
    try {
      const result = await taskManager.executeDAG(taskId, triggeredBy);
      return { dagExecutionId: result.id, status: result.status };
    } catch (error) {
      reply.code(400);
      return { error: error?.message };
    }
  });
  
  // GET /api/tasks/:id/status - Get task execution status
  fastify.get('/api/tasks/:id/status', {
    schema: {
      description: 'Get running tasks status',
      tags: ['tasks']
    }
  }, async (request, reply) => {
    const running = taskManager.getRunningTasks();
    return { running };
  });
  
  // POST /api/tasks/:id/cancel - Cancel task execution
  fastify.post('/api/tasks/:id/cancel', {
    schema: {
      description: 'Cancel a running task execution',
      tags: ['tasks']
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const executionId = parseInt(id);
    
    await taskManager.cancelExecution(executionId);
    return { message: `Execution ${executionId} cancelled` };
  });
  
  // POST /api/tasks/reload - Reload task configurations
  fastify.post('/api/tasks/reload', {
    schema: {
      description: 'Reload task configurations from files',
      tags: ['tasks']
    }
  }, async (request, reply) => {
    await taskManager.reloadTasks();
    const tasks = taskManager.getAllTasks();
    return { message: 'Tasks reloaded', count: tasks.length };
  });
}

module.exports = tasksRoutes;
