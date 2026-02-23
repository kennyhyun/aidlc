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

## Workspace Management

TaskMan supports workspace switching to manage multiple project directories. The workspace determines the working directory for Kiro CLI execution.

### Commands

**Chatbot:**
- `!workspace` - Show current workspace
- `!workspace <path>` - Switch to workspace
- `!workspace list` - List recent workspaces (up to 5)
- `!workspace default` - Switch to default workspace
- `!workspace default <path>` - Set default workspace

**API:**
- `GET /api/workspace` - Get current workspace
- `POST /api/workspace/switch` - Switch workspace
  ```json
  {"path": "/path/to/workspace"}
  ```
- `POST /api/workspace/default` - Set default workspace
  ```json
  {"path": "/path/to/workspace"}
  ```
- `GET /api/workspace/default` - Get default workspace
- `GET /api/workspace/list?limit=10` - List workspaces
- `DELETE /api/workspace/:id` - Delete workspace history

### How It Works

- **Current workspace** is used for Kiro CLI execution
- **Default workspace** is automatically set on first run to:
  1. Current workspace (if exists)
  2. First valid task workdir (if exists)
  3. `process.cwd()` (as fallback)
- **Workspace history** tracks access count and last accessed time
- **Task workdir** is independent of workspace settings (tasks run in their configured workdir)

### Example Usage

```bash
# Switch to a project directory
curl -X POST http://localhost:8254/api/workspace/switch \
  -H "Content-Type: application/json" \
  -d '{"path": "/Users/kenny/Projects/my-project"}'

# Set as default
curl -X POST http://localhost:8254/api/workspace/default \
  -H "Content-Type: application/json" \
  -d '{"path": "/Users/kenny/Projects/my-project"}'

# List recent workspaces
curl http://localhost:8254/api/workspace/list
```

## Session Management

TaskMan uses kiro-cli with session persistence to maintain conversation context across multiple interactions.

### Features

- **Automatic Session Persistence**: Conversations are saved per workspace
- **Context Size Display**: Token usage shown in responses
- **Session Termination**: Use `bye` to clear current session
- **Workspace Isolation**: Each workspace has independent session

### Usage

**Continue Conversation:**
```
User: "빌드 실행해줘"
Bot: "빌드를 실행하겠습니다..."
     [워크스페이스: /project/A]
     [컨텍스트: 15% (3000/20000 토큰)]

User: "결과 어때?"
Bot: "빌드가 성공적으로 완료되었습니다..."
     [워크스페이스: /project/A]
     [컨텍스트: 22% (4400/20000 토큰)]
```

**Switch Workspace:**
```
User: "!workspace /project/B"
Bot: "워크스페이스가 변경되었습니다: /project/B
     
     이전 워크스페이스(/project/A)의 세션은 보존되어 있습니다.
     해당 워크스페이스로 돌아가면 대화를 이어갈 수 있습니다."
```

**Clear Session:**
```
User: "bye"
Bot: "세션이 종료되었습니다. 다음 대화는 새로운 세션으로 시작됩니다."
```

### Session Storage

Sessions are stored in `.kiro/sessions/` directory within each workspace. Each workspace maintains its own independent conversation history.

### Context Size

The context size indicator shows:
- Percentage of token usage (e.g., 25%)
- Absolute token count (e.g., 5000/20000)

When context approaches 100%, consider starting a new session with `bye`.

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

### Workspace

- `GET /api/workspace` - Get current workspace
- `POST /api/workspace/switch` - Switch workspace
- `POST /api/workspace/default` - Set default workspace
- `GET /api/workspace/default` - Get default workspace
- `GET /api/workspace/list` - List workspaces
- `DELETE /api/workspace/:id` - Delete workspace

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
