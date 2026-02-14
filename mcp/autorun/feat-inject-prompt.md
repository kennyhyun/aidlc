# System Prompt Auto-Injection

## Goal

Read `system-prompt.md` file and automatically include it in the initial kiro-cli query.

## Implementation

### Phase 1: System Prompt Injection (TDD)
**Implementation:**
- [x] Check if `aidlc/subagents/{agentName}/system-prompt.md` file exists
- [x] Read file contents
- [x] Add system-prompt.md contents as the first message
- [x] Add user question as the second message
- [x] Pass to kiro-cli

**Tests:**
- [x] Verify system-prompt.md is included as first message when it exists
- [x] Verify only user question is passed when system-prompt.md doesn't exist
- [x] Verify error handling when file read fails

## Example

**system-prompt.md:**
```markdown
# Test Agent

You are a test automation specialist.

## Guidelines
- Write comprehensive tests
- Follow TDD approach
```

## Notes

Since kiro-cli doesn't process "Read this first" instructions in system-prompt.md, referenced file contents must be directly included.
