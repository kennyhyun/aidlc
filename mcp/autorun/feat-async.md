# Autorun Asynchronous Request Feature

## Overview

Improve the current `ask` tool behaviour to handle quick tasks synchronously and long tasks asynchronously.

## Feature Specification

### ask Tool (Modified)
- **Default Mode (Hybrid):**
  - Completes within 10s: Return result (synchronous)
  - Takes over 10s: Return token and run in background (asynchronous)
- **async Parameter (Optional):**
  - `async: true` → Return token immediately (explicit async)
  - `async: false` → Wait for completion (explicit sync)
- **Token Response Format:**
  - Token, status, summary
  - Usage instructions (await/halt)

### await Tool (New)
- Wait for specific request completion by token
- Timeout: 55 seconds
- Response Information:
  - Operation status (running/completed/failed)
  - Log file line count
  - Timeout status
  - summary file content (when completed)
  - Timeout message: "Task still running. Call await again to continue waiting."
- Can be called multiple times (allows waiting over 55s)

### halt Tool (New)
- Cancel specific request by token
- Stop background process
- Clean up log files


## Testing Strategy

- **Code Coverage Target:** 80% or higher
- **kiro-cli Mocking:** Recommended
  - Mock spawn calls for fast tests
  - Verify state transitions without actual processes
  - Use real kiro-cli only in integration tests (optional)
- **Each Phase is independently testable**
  - Phase 1-6: Unit tests (using mocks)
  - Phase 7: MCP manual testing (verify actual behaviour)
  - Must pass tests before proceeding to next Phase


## Task List

### Phase 1: State Management Foundation (TDD)
**Implementation:**
- [x] State store class implementation (Map: token → {status, pid, logPath, role})
- [x] Token generation function (6-character random hex: `XXXXXX`)
- [x] Log path generation function (`aidlc/subagents/{role}/data/history/{token}.log`)
- [x] State CRUD methods (create, get, update, delete)

**Tests:**
- [x] Token generation format validation
- [x] State save/retrieve/update/delete validation
- [x] Log path generation validation
- [x] Concurrency handling validation (prevent duplicate token generation)

### Phase 2: Background Process Execution (TDD)
**Implementation:**
- [x] Background spawn logic (detached mode)
- [x] Process state tracking (running → completed/failed)
- [x] Log file stream connection
- [x] Process termination detection and state update
- [x] Summary file automatic generation
  - Extract last response from log (after removing ANSI colour codes)
  - Last response = content after last `> ` prompt (or until end of log)
  - Save extracted content to summary file

**Tests:**
- [x] Verify process creation with spawn mocking
- [x] Verify state transition on process completion
- [x] Verify state transition on process failure
- [x] Verify log file creation
- [x] Verify ANSI colour code removal
- [x] Verify content extraction after last `> ` prompt
- [x] Verify entire log saved when no prompt exists

### Phase 3: ask Tool - Explicit Async Mode (TDD)
**Implementation:**
- [x] `async: true` parameter handling
- [x] Immediate token return logic
- [x] Background execution integration
- [x] Token response format (token, status, summary, usage)

**Tests:**
- [x] Verify immediate token return when async=true
- [x] Verify background process start
- [x] Verify response format
- [x] Verify summary generation logic

### Phase 4: ask Tool - Hybrid Mode (TDD)
**Implementation:**
- [x] 10-second timeout logic
- [x] Automatic sync/async switching
- [x] `async: false` explicit synchronous handling
- [x] Maintain existing synchronous response format

**Tests:**
- [x] Verify result return when completed within 10s
- [x] Verify token return when exceeds 10s
- [x] Verify wait for completion when async=false
- [x] Verify timeout boundary cases

### Phase 5: await Tool Implementation (TDD)
**Implementation:**
- [x] Token-based state lookup
- [x] 55-second timeout polling
- [x] Log file line count
- [x] Status response format (status, lineCount, timeout)
- [x] summary file reading and return

**Tests:**
- [x] Verify valid token lookup
- [x] Verify invalid token error handling
- [x] Verify immediate return for completed tasks
- [x] Verify 55-second timeout
- [x] Verify log line count
- [x] Verify summary file content return when exists
- [x] Verify null return when summary file doesn't exist

### Phase 6: halt Tool Implementation (TDD)
**Implementation:**
- [x] Process termination logic (SIGTERM → SIGKILL)
- [x] State update (cancelled)
- [x] Memory cleanup

**Tests:**
- [x] Verify process termination
- [x] Verify state update
- [x] Verify error handling when halting already completed task
- [x] Verify invalid token error handling

### Phase 7: MCP Manual Testing
**Tests (Manual):**
- [x] Verify ask tool call after MCP server restart
- [ ] ask(async=true) → Verify token return
- [x] await(token) → Verify result
- [ ] halt(token) → Verify cancellation
- [x] ask(hybrid) → Verify 10s boundary behaviour

## Implementation Considerations

- Process Isolation: Each request runs in independent child process
- State Tracking: In-memory store (resets on process restart)
- Cleanup: Remove completed requests from memory (keep log files)
- Error Handling: Remove state on process crash
- Hybrid Timeout: 10 seconds (adjustable)


## Usage Examples

### Default Mode (Hybrid)
```
ask(agentName: "test", question: "quick task")
→ Completes within 10s → Return result

ask(agentName: "test", question: "long task")
→ Takes over 10s → Return token
Response:
  Token: a3f2c1
  Status: running
  Summary: long task started
  Next: await to get the response, halt to cancel
```

### Explicit Async
```
ask(agentName: "test", question: "task", async: true)
→ Return token immediately
```

### Explicit Sync
```
ask(agentName: "test", question: "task", async: false)
→ Wait for completion (return result)
```

## Out of Scope

- Conversation Resume Feature (`--resume`): kiro-cli only generates session ID after conversation completion, so resuming during execution is not possible
