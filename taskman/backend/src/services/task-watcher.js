const chokidar = require('chokidar');
const debounce = require('lodash.debounce');

class TaskWatcher {
  constructor(configDir = './config/tasks', debounceMs = 60000) {
    this.configDir = configDir;
    this.debounceMs = debounceMs;
    this.watcher = null;
    this.changeHandler = null;
    this.debouncedReload = null;
  }
  
  onChange(handler) {
    this.changeHandler = handler;
  }
  
  async start() {
    this.debouncedReload = debounce(async () => {
      if (this.changeHandler) {
        await this.changeHandler();
      }
    }, this.debounceMs);
    
    this.watcher = chokidar.watch(`${this.configDir}/**/*.yaml`, {
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher.on('change', (path) => {
      this.debouncedReload();
    });
    
    this.watcher.on('add', (path) => {
      this.debouncedReload();
    });
    
    this.watcher.on('unlink', (path) => {
      this.debouncedReload();
    });
  }
  
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    if (this.debouncedReload) {
      this.debouncedReload.cancel();
      this.debouncedReload = null;
    }
  }
}

module.exports = TaskWatcher;
