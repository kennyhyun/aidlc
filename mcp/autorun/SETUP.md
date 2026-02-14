# Autorun MCP Setup Guide

## 1. VS Code Configuration

Add to `~/.config/Code/User/globalStorage/amazonwebservices.amazon-q-vscode/mcp-servers.json`:

```json
{
  "mcpServers": {
    "autorun": {
      "command": "node",
      "args": ["/home/kenny/Projects/imagine-online/aidlc/mcp/autorun/index.js"]
    }
  }
}
```

## 2. Restart VS Code

After configuration, restart VS Code to load the `autorun` MCP server.

## 3. Usage

In Amazon Q chat:

```
Ask default agent: "Review this code"
Ask reviewer agent: "What are the security issues in this code?"
Ask architect agent: "Design a microservices architecture"
Ask test agent: "Suggest a testing strategy"
```

## 4. Check History

Conversation content is saved to:
- `aidlc/subagents/{agentName}/data/history/{timestamp}.log`
- `aidlc/subagents/{agentName}/data/history/{timestamp}.summary.md`
