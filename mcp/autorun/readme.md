# Autorun MCP

## Goal

Implement an autorun MCP server with completely isolated context, allowing VS Code's main Amazon Q to invoke it as a tool.

### Features
1. **Agent Mode Execution**: Run with system prompt in agent mode
2. **Multiple Subagents**: Select purpose-specific subagents (default, reviewer, architect, test)
3. **History Storage**: Save entire conversation to `aidlc/subagents/{agentName}/data/history/{timestamp}.log`
4. **Auto Summary**: Summarize conversation in separate session and return via MCP response
5. **Progress Display**: Show progress status via MCP progress notification during execution
6. **Async Execution**: Hybrid mode (sync <10s, async >10s) with explicit async/await/halt tools

## Deliverables

1. **Node.js MCP Server** (`aidlc/mcp/autorun/`)
   - `index.js`: MCP server providing `ask` tool with `agentName` parameter for multiple agents
   - `package.json`: MCP SDK and dependency configuration
   - `mcp-servers.json`: VS Code MCP configuration example (server name: `autorun`)

2. **Subagent Configuration** (`aidlc/subagents/`)
   ```
   aidlc/subagents/
   ├── default/          # Default subagent
   ├── reviewer/         # Code review specialist
   ├── architect/        # Architecture design specialist
   └── test/             # Test automation specialist
       ├── config.json
       ├── system-prompt.md    # Optional - auto-injected if exists
       └── data/history/
   ```

   **OPTIONAL**: If `system-prompt.md` exists, it will be automatically read and injected into the conversation.

## Success Criteria

1. ✅ **Tool Invocation Success**: Receive response when asking questions via `ask` tool in VS Code
2. ✅ **Multiple Agents**: Select reviewer, architect, test, etc. via `agentName` parameter
3. ✅ **MCP Integration**: Tool automatically loads after VS Code restart
4. ✅ **History Storage**: Conversation saved as markdown in `data/history/` folder
5. ✅ **Summary Return**: Return summarized content via MCP response (full content in history file)
6. ✅ **Progress Display**: Show progress rate during execution (0/3 → 1/3 → 2/3 → 3/3)
7. ✅ **Async Execution**: ask tool with hybrid mode, await/halt tools for long-running tasks

## History File Format

- **Log File**: Real-time output with ANSI codes in `.log` file
- **Summary File**: Extracted or generated summary in `.summary.md` file

## Context Isolation Mechanism

### Shared
- **HOME**: Uses same `~/.aws/` as main agent
- **SSO Session**: Shares AWS credentials (no login required)

### Isolated
- **LLM conversationId**: Creates new session each time `kiro-cli` runs
- **Conversation Context**: Subagent doesn't remember previous conversations

**Result**: Each `kiro-cli` invocation is an independent session, so context is completely isolated from LLM perspective


## Implementation Plan

- [x] **Step 1: Agent Mode Execution** - Execute `kiro-cli chat --no-interactive "question"` with optional `system-prompt.md` auto-injection and collect full output
- [x] **Step 2: History Storage** - Remove ANSI codes and save to `aidlc/subagents/{agentName}/data/history/{timestamp}.log`
- [x] **Step 3: Summary Generation** - Read saved history file and request summary in separate session
- [x] **Step 4: MCP Response** - Return summary only (full content in history file reference)
- [x] **Step 5: Multiple Agent Implementation**
  - MCP tool name: `ask`
  - Add `agentName` parameter (enum: default, reviewer, architect, test)
  - Extract `agentName` parameter in index.js and execute `kiro-cli chat --no-interactive`
  - Create `system-prompt.md` for each agent (reviewer, architect, test) - **auto-injected if exists**
  - Separate history storage path to `aidlc/subagents/${agentName}/data/history/`
  - Verify: Check each agent invocation and history separation
- [x] **Step 6: Progress Display**
  - Use MCP progress notification API
  - Update progress rate for each step (0/3, 1/3, 2/3, 3/3)
- [x] **Step 7: Async Execution** (See [feat-async.md](./feat-async.md))
  - Modify `ask` tool: hybrid mode (sync <10s, async >10s), explicit async parameter
  - Add `await` tool: wait for async task completion with 55s timeout
  - Add `halt` tool: cancel running async task
  - Background process management with token-based tracking
  - Auto-generate summary files from logs
- [x] **Step 8: System Prompt Auto-Injection** (See [feat-inject-prompt.md](./feat-inject-prompt.md))
  - Parse "Read this first {filepath}" directives in system-prompt.md
  - Recursively collect referenced files
  - Merge into single prompt and pass to kiro-cli
  - Handle circular references and missing files
