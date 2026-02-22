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
