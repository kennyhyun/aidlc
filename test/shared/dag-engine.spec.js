const DAGEngine = require('../../src/shared/dag-engine');

describe('DAGEngine', () => {
  let engine;
  
  beforeEach(() => {
    engine = new DAGEngine();
  });
  
  test('should build graph from tasks', () => {
    const tasks = [
      { id: 'build-a3f2', name: 'Build', needs: [] },
      { id: 'test-7b4e', name: 'Test', needs: ['build-a3f2'] },
      { id: 'deploy-c8d1', name: 'Deploy', needs: ['build-a3f2', 'test-7b4e'] }
    ];
    
    const graph = engine.buildGraph(tasks);
    
    expect(graph.nodes.size).toBe(3);
    expect(graph.nodes.get('test-7b4e').dependencies.size).toBe(1);
    expect(graph.nodes.get('deploy-c8d1').dependencies.size).toBe(2);
  });
  
  test('should detect circular dependencies', () => {
    const tasks = [
      { id: 'a', name: 'A', needs: ['b'] },
      { id: 'b', name: 'B', needs: ['c'] },
      { id: 'c', name: 'C', needs: ['a'] }
    ];
    
    expect(() => engine.buildGraph(tasks)).toThrow('Circular dependency');
  });
  
  test('should perform topological sort', () => {
    const tasks = [
      { id: 'build-a3f2', name: 'Build', needs: [] },
      { id: 'test-7b4e', name: 'Test', needs: ['build-a3f2'] },
      { id: 'deploy-c8d1', name: 'Deploy', needs: ['build-a3f2', 'test-7b4e'] }
    ];
    
    const graph = engine.buildGraph(tasks);
    const sorted = engine.topologicalSort(graph);
    
    expect(sorted).toHaveLength(3);
    expect(sorted.indexOf('build-a3f2')).toBeLessThan(sorted.indexOf('test-7b4e'));
    expect(sorted.indexOf('test-7b4e')).toBeLessThan(sorted.indexOf('deploy-c8d1'));
  });
});
