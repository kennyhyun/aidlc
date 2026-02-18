async function executionsRoutes(fastify) {
  const { taskManager } = fastify;
  
  // GET /api/executions - List all executions
  fastify.get('/api/executions', {
    schema: {
      description: 'List all task executions',
      tags: ['executions']
    }
  }, async (request, reply) => {
    const { date } = request.query;
    
    let executions;
    if (date) {
      executions = taskManager.getExecutionsByDate(date);
    } else {
      // Get today's executions by default
      const today = new Date().toISOString().split('T')[0];
      executions = taskManager.getExecutionsByDate(today);
    }
    
    return { executions };
  });
  
  // GET /api/executions/:id - Get execution details
  fastify.get('/api/executions/:id', {
    schema: {
      description: 'Get execution details by ID',
      tags: ['executions']
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const executionId = parseInt(id);
    
    const execution = taskManager.getTaskExecution(executionId);
    
    if (!execution) {
      reply.code(404);
      return { error: `Execution not found: ${id}` };
    }
    
    return { execution };
  });
  
  // GET /api/executions/:id/logs - Get execution logs
  fastify.get('/api/executions/:id/logs', {
    schema: {
      description: 'Get execution logs',
      tags: ['executions']
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const executionId = parseInt(id);
    
    try {
      const logs = taskManager.getExecutionLogs(executionId);
      return { logs };
    } catch (error) {
      reply.code(404);
      return { error: error?.message };
    }
  });
}

module.exports = executionsRoutes;
