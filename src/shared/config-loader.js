const yaml = require('js-yaml');
const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigLoader {
  constructor(configDir = './config/tasks') {
    this.configDir = configDir;
  }
  
  async loadTasks() {
    const files = await this.getYamlFiles();
    const allTasks = [];
    
    for (const file of files) {
      const tasks = await this.loadTasksFromFile(file);
      allTasks.push(...tasks);
    }
    
    // Generate IDs for tasks without them
    allTasks.forEach(task => {
      if (!task.id) {
        task.id = this.generateTaskId(task.name);
      }
    });
    
    return allTasks;
  }
  
  async getYamlFiles() {
    const entries = await fs.readdir(this.configDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.yaml'))
      .map(entry => path.join(this.configDir, entry.name));
  }
  
  async loadTasksFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(content);
    
    if (!data || !data.tasks) {
      return [];
    }
    
    return data.tasks.map(task => ({
      ...task,
      filePath
    }));
  }
  
  generateTaskId(name) {
    const slug = this.slugify(name);
    const hex = crypto.randomBytes(2).toString('hex');
    return `${slug}-${hex}`;
  }
  
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = ConfigLoader;
