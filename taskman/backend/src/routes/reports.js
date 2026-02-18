async function reportsRoutes(fastify) {
  const { taskManager } = fastify;
  
  // GET /api/reports/daily - Get daily report
  fastify.get('/api/reports/daily', {
    schema: {
      description: 'Get daily execution report',
      tags: ['reports']
    }
  }, async (request, reply) => {
    const { date } = request.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const executions = taskManager.getExecutionsByDate(targetDate);
    
    const total = executions.length;
    const success = executions.filter(e => e.status === 'success').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    
    return {
      date: targetDate,
      total,
      success,
      failed,
      running,
      executions: executions.map(e => ({
        id: e.id,
        taskId: e.task_id,
        taskName: e.task_name,
        status: e.status,
        startedAt: e.started_at,
        completedAt: e.completed_at,
        duration: e.duration
      }))
    };
  });
  
  // GET /api/reports/summary - Get summary statistics
  fastify.get('/api/reports/summary', {
    schema: {
      description: 'Get execution summary statistics',
      tags: ['reports']
    }
  }, async (request, reply) => {
    const today = new Date().toISOString().split('T')[0];
    const todayExecutions = taskManager.getExecutionsByDate(today);
    const running = taskManager.getRunningTasks();
    
    return {
      today: {
        total: todayExecutions.length,
        success: todayExecutions.filter(e => e.status === 'success').length,
        failed: todayExecutions.filter(e => e.status === 'failed').length
      },
      running: running.map(e => ({
        id: e.id,
        taskId: e.task_id,
        taskName: e.task_name,
        startedAt: e.started_at
      }))
    };
  });
}

module.exports = reportsRoutes;
