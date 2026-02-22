const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

class WorkspaceService {
  constructor(db, taskManager) {
    this.db = db;
    this.taskManager = taskManager;
  }
}

module.exports = WorkspaceService;
