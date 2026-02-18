class ExecutionEngine {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = Math.min(Math.max(maxConcurrent, 1), 8);
    this.running = new Map();
    this.completed = new Set();
    this.failed = new Set();
  }
  
  async executeDAG(graph, dagExecutionId, onStart, onComplete) {
    const readyQueue = this.getReadyTasks(graph);
    const results = [];
    
    while (readyQueue.length > 0 || this.running.size > 0) {
      // Fill up to max concurrent
      while (readyQueue.length > 0 && this.running.size < this.maxConcurrent) {
        const taskId = readyQueue.shift();
        this.startTask(taskId, graph, dagExecutionId, onStart, onComplete, results);
      }
      
      // Wait for at least one task to complete
      if (this.running.size > 0) {
        await Promise.race(this.running.values());
      }
      
      // Check for newly ready tasks
      const newReady = this.getReadyTasks(graph);
      readyQueue.push(...newReady);
    }
    
    return results;
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
  
  startTask(taskId, graph, dagExecutionId, onStart, onComplete, results) {
    const node = graph.nodes.get(taskId);
    const task = node.config;
    
    const promise = (async () => {
      let executionId;
      
      try {
        // Call onStart callback if provided
        if (onStart) {
          executionId = await onStart(task);
        }
        
        const result = await this.executeTask(task);
        
        // Call onComplete callback if provided
        if (onComplete) {
          await onComplete(task, executionId, result, 'success');
        }
        
        this.completed.add(taskId);
        this.running.delete(taskId);
        
        results.push({ taskId, status: 'success', result });
      } catch (error) {
        // Call onComplete callback if provided
        if (onComplete) {
          await onComplete(task, executionId, { stderr: error?.message }, 'failed');
        }
        
        if (task.continue_on_failure) {
          this.completed.add(taskId);
        } else {
          this.failed.add(taskId);
        }
        this.running.delete(taskId);
        
        results.push({ taskId, status: 'failed', error: error?.message });
      }
    })();
    
    this.running.set(taskId, promise);
  }
  
  async executeTask(task) {
    // Simple implementation - can be overridden
    const KiroWrapper = require('./kiro-wrapper');
    const wrapper = new KiroWrapper();
    
    return wrapper.executeCommand({
      command: task.command,
      workdir: task.workdir || process.cwd(),
      timeout: task.timeout || 1800
    });
  }
}

module.exports = ExecutionEngine;
