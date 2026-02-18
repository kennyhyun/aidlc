# TaskMan Backend

Task Manager for AI Development Lifecycle - Backend Service

## Features

- ✅ Task execution with dependency management (DAG)
- ✅ REST API for task management
- ✅ SQLite database for execution history
- ✅ Telegram bot integration
- ✅ Real-time notifications
- ✅ Concurrent task execution with limits
- ✅ YAML-based task configuration
- ✅ Swagger API documentation

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=8254
DATABASE_PATH=./data/taskman.db
TASK_CONFIG_DIR=./config/tasks
MAX_CONCURRENT_TASKS=3

# Telegram Bot (optional)
MESSAGING_PLATFORM=telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 3. Create Task Configuration

Create `config/tasks/example.yaml`:

```yaml
tasks:
  - id: hello-world-a1b2
    name: "Hello World"
    command: "echo 'Hello from TaskMan!'"
    workdir: "."
    timeout: 10
    
  - id: build-backend-c3d4
    name: "Build Backend"
    command: "npm run build"
    workdir: "./backend"
    timeout: 300
    
  - id: run-tests-e5f6
    name: "Run Tests"
    command: "npm test"
    workdir: "./backend"
    timeout: 600
    needs: ["build-backend-c3d4"]
```

### 4. Start Server

```bash
npm start
```

Server will start on http://localhost:8254

## Telegram Bot Setup

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the bot token (e.g., `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Chat ID

1. Start a chat with your bot
2. Send any message to your bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":123456789}` in the response
5. Copy the chat ID

### 3. Configure .env

```env
MESSAGING_PLATFORM=telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 4. Test Bot

Start the server and send messages to your bot:

- `/help` - Show available commands
- `/status` - Show running tasks
- `/list` - List all tasks
- `/run <task-id>` - Execute a task
- "상태" - Check status (Korean)
- "목록" - List tasks (Korean)
- "실행 hello" - Run task (Korean)

## API Endpoints

### Tasks

- `GET /api/tasks` - List all tasks
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks/execute` - Execute a task
- `POST /api/tasks/execute-dag` - Execute task with dependencies
- `GET /api/tasks/:id/status` - Get running tasks
- `POST /api/tasks/:id/cancel` - Cancel execution
- `POST /api/tasks/reload` - Reload task configurations

### Executions

- `GET /api/executions` - List executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/executions/:id/logs` - Get execution logs

### Reports

- `GET /api/reports/daily` - Daily execution report
- `GET /api/reports/summary` - Summary statistics

### Cron

- `POST /api/cron/trigger` - Trigger task from cron

## API Documentation

Swagger UI available at: http://localhost:8254/docs

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test
npm test -- test/services/task-manager.spec.js
```

## Development

```bash
# Start in development mode with auto-reload
npm run dev
```

## Task Configuration

Tasks are defined in YAML files in `config/tasks/` directory.

### Task Properties

- `id` - Unique task identifier (auto-generated if not provided)
- `name` - Human-readable task name
- `command` - Shell command to execute
- `workdir` - Working directory (optional)
- `timeout` - Timeout in seconds (default: 1800)
- `needs` - Array of task IDs or names this task depends on
- `if` - Execution condition: `all_success`, `any_success`, `always`
- `continue_on_failure` - Continue DAG execution even if this task fails

### Example

```yaml
tasks:
  - name: "Build"
    command: "npm run build"
    timeout: 300
    
  - name: "Test"
    command: "npm test"
    needs: ["Build"]
    
  - name: "Deploy"
    command: "npm run deploy"
    needs: ["Build", "Test"]
    if: "all_success"
```

## Architecture

```
┌─────────────────────────────────────┐
│         Fastify Server              │
│  - REST API                         │
│  - Swagger Documentation            │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────────┐
│   Task      │  │   Messaging    │
│  Manager    │  │   Service      │
│             │  │                │
│ - DAG       │  │ - Telegram     │
│ - Execution │  │ - Slack        │
│ - Database  │  │ - Notifications│
└─────────────┘  └────────────────┘
```

## License

MIT
