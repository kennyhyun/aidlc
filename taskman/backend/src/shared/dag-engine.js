class DAGEngine {
  buildGraph(tasks) {
    const graph = {
      nodes: new Map(),
      edges: new Map()
    };
    
    // Add all nodes
    tasks.forEach(task => {
      graph.nodes.set(task.id, {
        id: task.id,
        name: task.name,
        config: task,
        inDegree: 0,
        dependencies: new Set(),
        dependents: new Set()
      });
    });
    
    // Add edges
    tasks.forEach(task => {
      const needs = task.needs || [];
      needs.forEach(depId => {
        this.addDependency(graph, task.id, depId);
      });
    });
    
    // Detect cycles
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      throw new Error(`Circular dependency detected: ${cycles[0].join(' → ')}`);
    }
    
    return graph;
  }
  
  addDependency(graph, taskId, dependsOnId) {
    const task = graph.nodes.get(taskId);
    const dependency = graph.nodes.get(dependsOnId);
    
    if (!task || !dependency) {
      throw new Error(`Task not found: ${taskId} or ${dependsOnId}`);
    }
    
    task.dependencies.add(dependsOnId);
    dependency.dependents.add(taskId);
    task.inDegree++;
  }
  
  detectCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    
    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat(nodeId);
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const node = graph.nodes.get(nodeId);
      node.dependencies.forEach(depId => {
        dfs(depId, [...path]);
      });
      
      recursionStack.delete(nodeId);
    };
    
    graph.nodes.forEach((node, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    });
    
    return cycles;
  }
  
  topologicalSort(graph) {
    const sorted = [];
    const queue = [];
    const inDegree = new Map();
    
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
    
    if (sorted.length !== graph.nodes.size) {
      throw new Error('Graph has cycles');
    }
    
    return sorted;
  }
}

module.exports = DAGEngine;
