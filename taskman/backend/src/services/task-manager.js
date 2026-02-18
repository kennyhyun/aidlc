const EventEmitter = require('events');
const ConfigLoader = require('../shared/config-loader');
const DAGEngine = require('../shared/dag-engine');
const ExecutionEngine = require('./execution-engine');
const Database = require('../models/database');

class TaskManager extends EventEmitter {
  constructor() {
    super();
    this.configLoader = null;
    this.dagEngine = null;
    this.executionEngine = null;
    this.database = null;
    this.tasks = [];
    this.taskMap = new Map();
  }
  
  async initialize(config) {
    // Initialize database
    this.database = new Database(config.database.path);
    await this.database.initialize();
    
    // Initialize components
    this.configLoader = new ConfigLoader(config.tasks.configDir);
    this.dagEngine = new DAGEngine();
    this.executionEngine = new ExecutionEngine(config.tasks.maxConcurrent);
    
    // Load tasks
    await this.loadTasks();
  }
  
  async loadTasks() {
    this.tasks = await this.configLoader.loadTasks();
    
    // Build task map for quick lookup
    this.taskMap.clear();
    this.tasks.forEach(task => {
      this.taskMap.set(task.id, task);
    });
    
    // Store in database
    this.tasks.forEach(task => {
      this.database.upsertTaskDefinition({
        id: task.id,
        name: task.name,
        file_path: task.filePath,
        last_updated: new Date().toISOString()
      });
    });
  }
  
  async reloadTasks() {
    await this.loadTasks();
    this.emit('tasks:reloaded', { count: this.tasks.length });
  }
  
  getAllTasks() {
    return this.tasks;
  }
  
  getTask(taskId) {
    return this.taskMap.get(taskId);
  }
  
  async executeTask(taskId, triggeredBy = 'manual') {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Create execution record
    const executionId = this.database.insertTaskExecution({
      task_id: taskId,
      task_name: task.name,
      status: 'running',
      started_at: new Date().toISOString(),
      triggered_by: triggeredBy
    });
    
    // Emit event
    this.emit('task:started', {
      taskId,
      taskName: task.name,
      executionId
    });
    
    // Execute task
    try {
      const result = await this.executionEngine.executeTask(task);
      
      // Update execution record
      this.database.updateTaskExecution(executionId, {
        status: 'success',
        completed_at: new Date().toISOString(),
        duration: result.duration,
        exit_code: result.code,
        stdout: result.stdout,
        stderr: result.stderr
      });
      
      // Emit event
      this.emit('task:completed', {
        taskId,
        taskName: task.name,
        executionId,
        duration: result.duration
      });
      
      return { id: executionId, status: 'success', result };
    } catch (error) {
      // Update execution record
      this.database.updateTaskExecution(executionId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        stderr: error?.message
      });
      
      // Emit event
      this.emit('task:failed', {
        taskId,
        taskName: task.name,
        executionId,
        error: error?.message
      });
      
      throw error;
    }
  }
  
  async executeDAG(rootTaskId, triggeredBy = 'manual') {
    const rootTask = this.getTask(rootTaskId);
    if (!rootTask) {
      throw new Error(`Task not found: ${rootTaskId}`);
    }
    
    // Build dependency graph
    const dependencyTasks = this.resolveDependencies(rootTaskId);
    const graph = this.dagEngine.buildGraph(dependencyTasks);
    
    // Create DAG execution record
    const dagExecutionId = this.database.insertDAGExecution({
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: triggeredBy,
      total_tasks: dependencyTasks.length,
      completed_tasks: 0,
      failed_tasks: 0
    });
    
    // Execute DAG
    try {
      const results = await this.executionEngine.executeDAG(
        graph,
        dagExecutionId,
        async (task) => {
          const executionId = this.database.insertTaskExecution({
            task_id: task.id,
            task_name: task.name,
            status: 'running',
            started_at: new Date().toISOString(),
            triggered_by: triggeredBy,
            parent_execution_id: dagExecutionId
          });
          
          this.emit('task:started', {
            taskId: task.id,
            taskName: task.name,
            executionId,
            dagExecutionId
          });
          
          return executionId;
        },
        async (task, executionId, result, status) => {
          this.database.updateTaskExecution(executionId, {
            status,
            completed_at: new Date().toISOString(),
            duration: result.duration,
            exit_code: result.code,
            stdout: result.stdout,
            stderr: result.stderr
          });
          
          if (status === 'success') {
            this.emit('task:completed', {
              taskId: task.id,
              taskName: task.name,
              executionId,
              duration: result.duration,
              dagExecutionId
            });
          } else {
            this.emit('task:failed', {
              taskId: task.id,
              taskName: task.name,
              executionId,
              error: result.stderr,
              dagExecutionId
            });
          }
        }
      );
      
      // Update DAG execution record
      const completedTasks = results.filter(r => r.status === 'success').length;
      const failedTasks = results.filter(r => r.status === 'failed').length;
      
      this.database.updateDAGExecution(dagExecutionId, {
        status: failedTasks > 0 ? 'failed' : 'success',
        completed_at: new Date().toISOString(),
        completed_tasks: completedTasks,
        failed_tasks: failedTasks
      });
      
      return { id: dagExecutionId, status: failedTasks > 0 ? 'failed' : 'success', results };
    } catch (error) {
      this.database.updateDAGExecution(dagExecutionId, {
        status: 'failed',
        completed_at: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  resolveDependencies(taskId, visited = new Set()) {
    if (visited.has(taskId)) {
      return [];
    }
    
    visited.add(taskId);
    const task = this.getTask(taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const dependencies = [];
    const needs = task.needs || [];
    
    // Resolve references (task names to IDs)
    const resolvedNeeds = needs.map(need => {
      // If it's already an ID, use it
      if (this.taskMap.has(need)) {
        return need;
      }
      
      // Otherwise, find by name
      const foundTask = this.tasks.find(t => t.name === need);
      if (!foundTask) {
        throw new Error(`Task not found: ${need}`);
      }
      return foundTask.id;
    });
    
    resolvedNeeds.forEach(depId => {
      dependencies.push(...this.resolveDependencies(depId, visited));
    });
    
    dependencies.push(task);
    return dependencies;
  }
  
  getRunningTasks() {
    return this.database.getRunningExecutions();
  }
  
  getTaskExecution(executionId) {
    return this.database.getTaskExecution(executionId);
  }
  
  getExecutionLogs(executionId) {
    const execution = this.database.getTaskExecution(executionId);
    
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    return {
      id: execution.id,
      taskId: execution.task_id,
      taskName: execution.task_name,
      status: execution.status,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      duration: execution.duration,
      exitCode: execution.exit_code,
      stdout: execution.stdout,
      stderr: execution.stderr
    };
  }
  
  getExecutionsByDate(date) {
    return this.database.getExecutionsByDate(date);
  }
  
  async cancelExecution(executionId) {
    // For now, just mark as cancelled
    // In future, implement actual process termination
    this.database.updateTaskExecution(executionId, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });
    
    this.emit('task:cancelled', { executionId });
  }
  
  async close() {
    if (this.database) {
      await this.database.close();
    }
  }
}

module.exports = TaskManager;
