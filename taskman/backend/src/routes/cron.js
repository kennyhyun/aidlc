async function cronRoutes(fastify) {
  const { taskManager } = fastify;
  
  // POST /api/cron/trigger - Trigger task from cron
  fastify.post('/api/cron/trigger', {
    schema: {
      description: 'Trigger task execution from cron job',
      tags: ['cron'],
      body: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          executeDAG: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    const { taskId, executeDAG = false } = request.body;
    
    try {
      let result;
      
      if (executeDAG) {
        result = await taskManager.executeDAG(taskId, 'cron');
        return {
          executionId: result.id,
          status: result.status,
          message: `DAG execution started for task: ${taskId}`
        };
      } else {
        result = await taskManager.executeTask(taskId, 'cron');
        return {
          executionId: result.id,
          status: result.status,
          message: `Task execution started: ${taskId}`
        };
      }
    } catch (error) {
      reply.code(400);
      return { error: error?.message };
    }
  });
}

module.exports = cronRoutes;
