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
  
  resolveReferences(tasks) {
    return tasks.map(task => {
      if (!task.needs || task.needs.length === 0) {
        return task;
      }
      
      const resolvedNeeds = task.needs.map(ref => this.resolveTaskId(ref, tasks));
      
      return {
        ...task,
        needs: resolvedNeeds
      };
    });
  }
  
  resolveTaskId(reference, allTasks) {
    // 1. If already a complete ID (ends with -XXXX), validate and use as-is
    if (/^[\w-]+-[0-9a-f]{4}$/.test(reference)) {
      const task = allTasks.find(t => t.id === reference);
      if (!task) {
        throw new Error(`Task not found: ${reference}`);
      }
      return reference;
    }
    
    // 2. Slugify the reference
    const slug = this.slugify(reference);
    
    // 3. Find tasks starting with the slug
    const matches = allTasks.filter(t => t.id.startsWith(slug + '-'));
    
    if (matches.length === 0) {
      throw new Error(`Task not found: ${reference}`);
    } else if (matches.length === 1) {
      return matches[0].id;
    } else {
      // Ambiguous reference
      const matchList = matches.map(m => `  - ${m.id} (${m.name})`).join('\n');
      throw new Error(
        `Ambiguous reference "${reference}". Multiple matches found:\n${matchList}\nPlease use full ID in needs`
      );
    }
  }
}

module.exports = ConfigLoader;
