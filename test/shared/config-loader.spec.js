const ConfigLoader = require('../../src/shared/config-loader');
const path = require('path');

describe('ConfigLoader', () => {
  let loader;
  
  beforeEach(() => {
    loader = new ConfigLoader(path.join(__dirname, '../fixtures/tasks'));
  });
  
  test('should load tasks from YAML files', async () => {
    const tasks = await loader.loadTasks();
    
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('Build Backend');
    expect(tasks[1].name).toBe('Run Tests');
  });
  
  test('should generate IDs for tasks without them', async () => {
    const tasks = await loader.loadTasks();
    
    tasks.forEach(task => {
      expect(task.id).toMatch(/^[\w-]+-[0-9a-f]{4}$/);
    });
  });
});
