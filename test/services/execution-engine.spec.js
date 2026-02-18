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
      return { code: 0, stdout: '', stderr: '' };
    };
    
    engine.executeTask = mockExecute;
    await engine.executeDAG(graph, 1);
    
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  }, 10000);
  
  test('should execute tasks in dependency order', async () => {
    const engine = new ExecutionEngine(3);
    const executionOrder = [];
    
    const tasks = [
      { id: 'build', name: 'Build', needs: [] },
      { id: 'test', name: 'Test', needs: ['build'] },
      { id: 'deploy', name: 'Deploy', needs: ['build', 'test'] }
    ];
    
    const dagEngine = new DAGEngine();
    const graph = dagEngine.buildGraph(tasks);
    
    const mockExecute = async (taskId) => {
      executionOrder.push(taskId);
      await new Promise(resolve => setTimeout(resolve, 50));
      return { code: 0, stdout: '', stderr: '' };
    };
    
    engine.executeTask = mockExecute;
    await engine.executeDAG(graph, 1);
    
    expect(executionOrder.indexOf('build')).toBeLessThan(executionOrder.indexOf('test'));
    expect(executionOrder.indexOf('test')).toBeLessThan(executionOrder.indexOf('deploy'));
  }, 10000);
});
