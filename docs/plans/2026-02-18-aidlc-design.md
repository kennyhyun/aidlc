# TaskMan (Task Manager) Design

**Date:** 2026-02-18  
**Status:** Updated  
**Type:** System Design  
**Project:** `aidlc/taskman/backend`

## Overview

TaskMan is a local development automation system that wraps Kiro CLI to execute AI-assisted tasks, manages complex task dependencies using DAG (Directed Acyclic Graph), and provides Telegram/Slack interface for monitoring and control.

**Deployment Options:**
- **Local Mode (Default)**: Run directly with Node.js for development and simple use cases
- **Docker Mode (Optional)**: Use Docker Compose for production deployment with cron scheduling

## Goals

- Automate long-running development tasks (2-30 minutes) with Kiro CLI
- Manage parallel task execution with DAG-based dependency resolution
- Provide Telegram/Slack interface for remote monitoring and control
- Support scheduled execution (via cron in Docker mode or external scheduler)
- Track task execution history and generate daily reports
- Run locally without Docker for development, optionally use Docker for production

## Non-Goals

- Multi-user support (single developer use case)
- Complex authentication/authorization
- Real-time streaming of task output
- Cloud-native deployment (designed for local/self-hosted use)

## System Architecture

### High-Level Architecture

```
┌─────────────────┐      HTTP      ┌──────────────────────┐
│  alpine-cron    │ ─────────────> │   Node.js Server     │
│  (Scheduler)    │                │   (Fastify)          │
└─────────────────┘                │                      │
                                   │  - Task Manager      │
                                   │  - Telegram Bot      │
┌─────────────────┐                │  - Kiro CLI Wrapper  │
│   Telegram      │ <────────────> │  - DAG Engine        │
│   (User)        │   Bot API      │  - SQLite DB         │
└─────────────────┘   (Polling)    └──────────────────────┘
                                            │
                                            v
                                   ┌──────────────────┐
                                   │  Host Volumes    │
                                   │  /storage/*      │
                                   └──────────────────┘
```

### Components

#### 1. Fastify Server (Node.js)
- **Purpose:** Core application logic
- **Responsibilities:**
  - Task execution and lifecycle management
  - DAG dependency resolution
  - Telegram bot interface
  - API endpoints for cron and manual triggers
  - Database operations
- **Technology:** Node.js 22 + Fastify + OpenAPI/Swagger

#### 2. alpine-cron Container
- **Purpose:** Scheduled task execution
- **Responsibilities:**
  - Execute cron jobs
  - Call Fastify HTTP endpoints
- **Technology:** kennyhyun/alpine-cron

#### 3. Telegram Bot
- **Purpose:** User interface
- **Responsibilities:**
  - Natural language command parsing
  - Interactive button interface
  - Status updates and notifications
  - Daily report delivery
- **Technology:** node-telegram-bot-api (long polling)
- **Connection:** Long polling (no external access required)

#### 4. SQLite Database
- **Purpose:** Data persistence
- **Responsibilities:**
  - Task execution history
  - Task definitions cache
  - System settings
- **Technology:** SQLite (file-based)

#### 5. Kiro CLI Wrapper
- **Purpose:** Execute AI-assisted tasks
- **Responsibilities:**
  - Spawn Kiro CLI processes
  - Capture stdout/stderr
  - Handle timeouts
- **Technology:** Node.js child_process

## Deployment Modes

### Local Mode (Default)

Run directly with Node.js:

```bash
cd aidlc/taskman/backend
npm install
npm start
```

**Configuration:**
- SQLite database: `./data/taskman.db`
- Task configs: `./config/tasks/*.yaml`
- Kiro CLI: Uses local installation
- Scheduling: Use external cron or task scheduler

### Docker Mode (Optional)

Use Docker Compose for production:

```yaml
services:
  taskman-server:
    image: node:22-alpine
    ports:
      - "8254:8254"
    volumes:
      - ./taskman/backend:/app
      - /storage:/storage          # Flexible workspace
      - ~/.kiro:/root/.kiro:ro     # Kiro CLI config (read-only)
      - ./data:/data               # SQLite database
    environment:
      - TELEGRAM_BOT_TOKEN
      - TELEGRAM_CHAT_ID
    
  taskman-cron:
    image: kennyhyun/alpine-cron
    volumes:
      - ./crontab:/etc/crontabs/root:ro
    depends_on:
      - taskman-server
```

**Volume Mounts:**
- `/storage`: Host workspace (configurable)
- `~/.kiro`: Kiro CLI configuration (read-only)
- `./data`: SQLite database (persistent)
- `./taskman/backend`: Application code

## Application Structure

### Directory Layout

```
aidlc/taskman/backend/
├── src/
│   ├── server.js              # Fastify server entry point
│   ├── config/
│   │   └── index.js           # Environment variables and configuration
│   ├── services/
│   │   ├── task-manager.js    # DAG execution and task management
│   │   ├── kiro-wrapper.js    # Kiro CLI execution
│   │   ├── telegram-bot.js    # Telegram interface
│   │   └── scheduler.js       # Internal scheduling logic
│   ├── models/
│   │   └── database.js        # SQLite schema and queries
│   ├── routes/
│   │   ├── tasks.js           # Task API endpoints
│   │   └── cron.js            # Cron callback endpoints
│   └── shared/
│       ├── dag-engine.js      # DAG dependency resolution
│       └── logger.js          # Logging utilities
├── config/
│   ├── tasks/                 # Task definitions (YAML)
│   │   ├── build.yaml
│   │   ├── test.yaml
│   │   └── deploy.yaml
│   ├── schedules.yaml         # Cron schedules
│   └── reports.yaml           # Report configuration
├── package.json
├── Dockerfile
└── .env
```

## Task Definition & DAG Engine

### Task Definition Format

Tasks are defined in YAML files under `config/tasks/`. Multiple tasks can be defined in a single file or split across multiple files.

```yaml
tasks:
  - name: "Build Backend Services"
    command: "kiro chat 'Build all backend services'"
    workdir: "/storage/imagine-online"
    timeout: 1800  # 30 minutes
    
  - name: "Run Tests"
    command: "kiro chat 'Run all tests'"
    workdir: "/storage/imagine-online"
    depends_on:
      - "Build Backend Services"
    timeout: 600
    
  - name: "Deploy to Staging"
    command: "kiro chat 'Deploy to staging environment'"
    workdir: "/storage/imagine-online"
    depends_on:
      - "Build Backend Services"
      - "Run Tests"
    condition: "all_success"  # Execute only if all dependencies succeed
```

### ID Generation and Resolution

**Automatic ID Generation:**
1. User writes task with `name` only
2. System generates ID: `slugify(name) + '-' + randomHex(4)`
3. YAML file is automatically updated with generated ID
4. Example: "Build Backend Services" → `build-backend-services-a3f2`

**Smart Reference Resolution:**
```javascript
function resolveTaskId(reference, allTasks) {
  // 1. If already a complete ID (ends with -XXXX), use as-is
  if (/^[\w-]+-[0-9a-f]{4}$/.test(reference)) {
    return reference;
  }
  
  // 2. Slugify the reference
  const slug = slugify(reference);
  
  // 3. Find tasks starting with the slug
  const matches = allTasks.filter(t => t.id.startsWith(slug + '-'));
  
  if (matches.length === 0) {
    // Create new task ID
    return `${slug}-${randomHex(4)}`;
  } else if (matches.length === 1) {
    // Unique match found
    return matches[0].id;
  } else {
    // Ambiguous reference - throw error
    throw new Error(
      `Ambiguous reference "${reference}". Multiple matches found:\n` +
      matches.map(m => `  - ${m.id} (${m.name})`).join('\n') +
      `\nPlease use full ID in depends_on`
    );
  }
}
```

**Error Handling with Comments:**

When errors occur during task parsing or resolution, the system adds comments to the YAML file:

```yaml
tasks:
  - id: build-backend-a3f2
    name: "Build Backend Services"
    
  - id: build-backend-f9e1
    name: "Build Backend API"
    
  - id: run-tests-7b4e
    name: "Run Tests"
    depends_on:
      - "Build Backend"
      # ❌ ERROR: Ambiguous reference "Build Backend"
      # Multiple matches found:
      #   - build-backend-a3f2 (Build Backend Services)
      #   - build-backend-f9e1 (Build Backend API)
      # Please replace with one of the full IDs above
```

### DAG Execution Logic

**Execution Flow:**
1. Parse YAML files and build task graph
2. Resolve all task references
3. Perform topological sort to determine execution order
4. Identify tasks with no dependencies (ready to execute)
5. Execute ready tasks in parallel using `Promise.all`
6. On task completion, check dependent tasks
7. Execute newly ready tasks
8. Continue until all tasks complete or fail

**Condition Types:**
- `all_success`: Execute only if all dependencies succeed (default)
- `any_success`: Execute if at least one dependency succeeds
- `always`: Execute regardless of dependency status

**Cycle Detection:**
The system detects circular dependencies and reports them with the cycle path.

## Telegram Bot Interface

### Interaction Modes

#### A) Natural Language Commands

Simple keyword matching for common intents:

```
User: "빌드 상태 알려줘"
Bot:  📊 Current Status:
      ✅ build-backend-a3f2: Completed (15m 30s)
      ⏳ run-tests-7b4e: Running (3/10)
      ⏸️ deploy-staging-c8d1: Waiting

User: "백엔드 빌드 돌려줘"
Bot:  ▶️ Starting task: build-backend-a3f2
      [Progress updates...]
```

#### B) Interactive Buttons

```
Bot: 📋 Task Management
     [▶️ Execute Task] [📊 Check Status] [⏸️ Pause]
     
User: [▶️ Execute Task] (click)
Bot:  Select a task:
      [🔨 Build Backend] [🧪 Run Tests] [🚀 Deploy]
```

#### C) Status Updates

Real-time notifications:
```
Bot: ✅ build-backend-a3f2 completed (15m 30s)
     ⏳ run-tests-7b4e running... (3/10)
     ⏸️ deploy-staging-c8d1 waiting
```

### Command Parsing

- Natural language → Intent recognition (simple keyword matching)
- Task name → ID resolution (using the same logic as YAML references)
- Button callbacks → Direct action execution

### Daily Report

- Scheduled delivery at configured time
- Customisable content (summary, failed tasks, long-running tasks)
- Configured via `config/reports.yaml`

### Connection Method

**Long Polling:**
- No external access required
- Configurable polling interval and timeout
- Default: 300ms interval, 10s timeout

```javascript
const bot = new TelegramBot(token, {
  polling: {
    interval: 300,        // Polling interval (ms)
    autoStart: true,
    params: {
      timeout: 10         // Long polling timeout (seconds)
    }
  }
});
```

## Database Schema

### Tables

```sql
-- Task execution history
CREATE TABLE task_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- pending, running, success, failed, cancelled
  started_at DATETIME,
  completed_at DATETIME,
  duration INTEGER,      -- seconds
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  triggered_by TEXT,     -- cron, telegram, manual, dependency
  parent_execution_id INTEGER,  -- DAG execution group
  FOREIGN KEY (parent_execution_id) REFERENCES dag_executions(id)
);

-- DAG execution groups
CREATE TABLE dag_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  status TEXT NOT NULL,  -- running, completed, failed
  triggered_by TEXT,
  total_tasks INTEGER,
  completed_tasks INTEGER,
  failed_tasks INTEGER
);

-- Task definition cache (for fast lookup)
CREATE TABLE task_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  last_updated DATETIME NOT NULL
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id, started_at);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_dag_executions_started_at ON dag_executions(started_at);
```

## API Endpoints (Fastify)

### Fastify Setup

```javascript
const fastify = require('fastify')({ logger: true });

// Swagger/OpenAPI
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: { 
      title: 'AIDLC API', 
      version: '1.0.0',
      description: 'AI Development Lifecycle Controller API'
    }
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs'
});
```

### Routes

#### Cron Endpoints

```javascript
POST /api/cron/trigger
  Body: { schedule_name: "daily-build" }
  Response: { execution_id: 123, status: "started" }
```

#### Task Management

```javascript
GET  /api/tasks
  Response: [{ id, name, ... }]

POST /api/tasks/execute
  Body: { task_id: "build-backend-a3f2", params: {} }
  Response: { execution_id: 123, status: "started" }

POST /api/tasks/execute-dag
  Body: { task_ids: ["build-backend-a3f2", "run-tests-7b4e"] }
  Response: { dag_execution_id: 45, status: "started" }

GET  /api/tasks/:task_id/status
  Response: { status: "running", progress: "3/10" }

POST /api/tasks/:task_id/cancel
  Response: { status: "cancelled" }
```

#### Execution History

```javascript
GET  /api/executions
  Query: ?status=running&limit=10
  Response: [{ id, task_id, status, ... }]

GET  /api/executions/:id
  Response: { id, task_id, status, stdout, stderr, ... }

GET  /api/executions/:id/logs
  Response: { stdout: "...", stderr: "..." }
```

#### Reports and Statistics

```javascript
GET  /api/reports/daily
  Query: ?date=2026-02-18
  Response: { summary, failed_tasks, long_running_tasks }

GET  /api/stats/summary
  Response: { total_executions, success_rate, avg_duration, ... }
```

#### Health Check

```javascript
GET /health
  Response: { status: "ok", uptime: 12345, tasks_running: 2 }
```

### Schema-Based Validation

All endpoints use JSON Schema for automatic validation and OpenAPI generation:

```javascript
fastify.post('/api/tasks/execute', {
  schema: {
    body: {
      type: 'object',
      required: ['task_id'],
      properties: {
        task_id: { type: 'string' },
        params: { type: 'object' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          execution_id: { type: 'integer' },
          status: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  // Implementation
});
```

## Kiro CLI Integration

### Wrapper Implementation

```javascript
// src/services/kiro-wrapper.js
const { spawn } = require('child_process');

const executeKiroCommand = async ({ command, workdir, timeout = 1800 }) => {
  return new Promise((resolve, reject) => {
    const process = spawn('kiro', ['chat', command], {
      cwd: workdir,
      env: { ...process.env },
      timeout: timeout * 1000
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    process.on('error', reject);
  });
};
```

### Features

- Execute Kiro CLI via `child_process.spawn`
- Real-time stdout/stderr capture
- Timeout support
- Working directory specification
- Environment variable passing

### Configuration

- Kiro CLI config mounted from host `~/.kiro` (read-only)
- API keys and authentication loaded automatically
- No manual configuration required in container

## Configuration & Environment

### Environment Variables

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_POLLING_INTERVAL=300
TELEGRAM_POLLING_TIMEOUT=10

# Server
PORT=8254
NODE_ENV=development

# Database
DATABASE_PATH=/data/aidlc.db

# Kiro CLI
KIRO_CONFIG_PATH=/root/.kiro

# Logging
LOG_LEVEL=info
```

### Configuration Files

#### schedules.yaml

```yaml
schedules:
  - name: daily-build
    cron: "0 2 * * *"    # Every day at 2 AM
    tasks:
      - build-backend
      - run-tests
      
  - name: hourly-check
    cron: "0 * * * *"    # Every hour
    tasks:
      - health-check
```

#### reports.yaml

```yaml
daily_report:
  enabled: true
  time: "09:00"
  include:
    - summary
    - failed_tasks
    - long_running_tasks
  exclude:
    - success_details
```

## Error Handling & Monitoring

### Error Handling Strategy

```javascript
// Fastify global error handler
fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error(error?.stack || error?.message);
  
  reply.status(error.statusCode || 500).send({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode || 500
  });
});

// Task execution error handling
const handleTaskError = async (taskId, error) => {
  await db.updateTaskExecution(executionId, {
    status: 'failed',
    stderr: error?.message,
    completed_at: new Date()
  });
  
  await telegram.sendMessage(
    `❌ Task failed: ${taskId}\n${error?.message}`
  );
};
```

### Monitoring

- Real-time task execution status tracking
- Long-running task alerts
- Immediate failure notifications
- System health checks

### Logging

- Fastify built-in logger (pino)
- Structured logging (JSON format)
- Log level filtering
- Context-aware log messages

## Deployment & Usage

### Initial Setup

**Local Mode:**
```bash
cd aidlc/taskman/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your tokens
nano .env

# Start server
npm start
# or for development
npm run dev
```

**Docker Mode:**
```bash
cd aidlc

# Copy environment template
cp taskman/backend/.env.example taskman/backend/.env

# Edit .env with your tokens
nano taskman/backend/.env

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f taskman-server
```

### Usage Flow

1. Define tasks in `config/tasks/*.yaml`
2. Configure schedules in `config/schedules.yaml`
3. Start Docker Compose
4. Interact via Telegram bot
5. Monitor execution via Telegram or API
6. Receive daily reports

### Telegram Commands

- "상태 알려줘" → Current task status
- "빌드 돌려줘" → Execute build task
- "로그 보여줘" → Show recent logs
- "취소해줘" → Cancel running task

## Technology Stack

### Core Technologies

- **Runtime:** Node.js 22
- **Web Framework:** Fastify
- **Database:** SQLite
- **Bot Framework:** node-telegram-bot-api
- **Scheduler:** kennyhyun/alpine-cron
- **AI Tool:** Kiro CLI

### Key Dependencies

```json
{
  "dependencies": {
    "fastify": "^4.x",
    "@fastify/swagger": "^8.x",
    "@fastify/swagger-ui": "^3.x",
    "node-telegram-bot-api": "^0.x",
    "better-sqlite3": "^9.x",
    "js-yaml": "^4.x"
  }
}
```

## Future Enhancements

### Phase 2 (Optional)

- Web UI for task management
- Task templates and presets
- Webhook support for external triggers
- Multi-workspace support
- Task result caching
- Retry policies and exponential backoff
- Task priority and queue management

### Phase 3 (Optional)

- Distributed execution (multiple workers)
- Task result artifacts storage
- Integration with CI/CD pipelines
- Advanced analytics and visualisations
- Custom plugin system

## Security Considerations

- Kiro CLI config mounted read-only
- Environment variables for sensitive data
- No external network exposure (except Telegram API)
- SQLite file permissions
- Container isolation

## Performance Considerations

- Fastify for high-performance API
- SQLite for lightweight persistence
- Parallel task execution where possible
- Efficient DAG resolution algorithm
- Long polling for reduced network overhead

## Limitations

- Single developer use case
- Local development environment only
- No built-in authentication/authorisation
- Limited to tasks that can be expressed as Kiro CLI commands
- No real-time streaming of task output (polling-based updates)

## Success Criteria

- Successfully execute Kiro CLI tasks from Docker container
- Manage complex task dependencies with DAG
- Provide responsive Telegram interface
- Track and query task execution history
- Generate useful daily reports
- Maintain system stability for long-running tasks

## References

- [Fastify Documentation](https://www.fastify.io/)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [kennyhyun/alpine-cron](https://hub.docker.com/r/kennyhyun/alpine-cron)
- [Kiro CLI Documentation](https://kiro.ai/docs)
