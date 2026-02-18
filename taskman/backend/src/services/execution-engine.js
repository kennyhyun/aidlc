class ExecutionEngine {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = Math.min(Math.max(maxConcurrent, 1), 8);
    this.running = new Map();
    this.completed = new Set();
    this.failed = new Set();
  }
  
  async executeDAG(graph, dagExecutionId) {
    const readyQueue = this.getReadyTasks(graph);
    
    while (readyQueue.length > 0 || this.running.size > 0) {
      // Fill up to max concurrent
      while (readyQueue.length > 0 && this.running.size < this.maxConcurrent) {
        const taskId = readyQueue.shift();
        this.startTask(taskId, graph, dagExecutionId);
      }
      
      // Wait for at least one task to complete
      if (this.running.size > 0) {
        await Promise.race(this.running.values());
      }
      
      // Check for newly ready tasks
      const newReady = this.getReadyTasks(graph);
      readyQueue.push(...newReady);
    }
  }
  
  getReadyTasks(graph) {
    const ready = [];
    
    graph.nodes.forEach((node, taskId) => {
      // Skip if already processed
      if (this.completed.has(taskId) || 
          this.failed.has(taskId) || 
          this.running.has(taskId)) {
        return;
      }
      
      // Check if all dependencies are satisfied
      const depsReady = this.checkDependencies(node, graph);
      if (depsReady) {
        ready.push(taskId);
      }
    });
    
    return ready;
  }
  
  checkDependencies(node, graph) {
    const task = graph.nodes.get(node.id).config;
    const condition = task.if || 'all_success';
    
    let satisfied = true;
    
    node.dependencies.forEach(depId => {
      if (condition === 'all_success') {
        if (!this.completed.has(depId)) {
          satisfied = false;
        }
      } else if (condition === 'any_success') {
        const anyCompleted = Array.from(node.dependencies)
          .some(id => this.completed.has(id));
        satisfied = anyCompleted;
      } else if (condition === 'always') {
        if (!this.completed.has(depId) && !this.failed.has(depId)) {
          satisfied = false;
        }
      }
    });
    
    return satisfied;
  }
  
  startTask(taskId, graph, dagExecutionId) {
    const node = graph.nodes.get(taskId);
    const task = node.config;
    
    const promise = this.executeTask(taskId, task, dagExecutionId)
      .then(() => {
        this.completed.add(taskId);
        this.running.delete(taskId);
      })
      .catch((error) => {
        if (task.continue_on_failure) {
          this.completed.add(taskId);
        } else {
          this.failed.add(taskId);
        }
        this.running.delete(taskId);
      });
    
    this.running.set(taskId, promise);
  }
  
  async executeTask(taskId, task, dagExecutionId) {
    // Override this method in tests or subclasses
    throw new Error('executeTask must be implemented');
  }
}

module.exports = ExecutionEngine;
