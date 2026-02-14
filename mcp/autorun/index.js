#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs';
import { StateStore } from './src/state-store.js';
import { BackgroundRunner } from './src/background-runner.js';
import { AskTool } from './src/ask-tool.js';
import { AwaitTool } from './src/await-tool.js';
import { HaltTool } from './src/halt-tool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scan subagent directories dynamically
const subagentsDir = join(__dirname, '../../subagents');
const { readdirSync, statSync } = await import('fs');
const agentNames = readdirSync(subagentsDir)
  .filter(name => statSync(join(subagentsDir, name)).isDirectory());

// Ensure 'default' agent exists
if (!agentNames.includes('default')) {
  const defaultDir = join(subagentsDir, 'default');
  await mkdir(defaultDir, { recursive: true }, () => {});
  const { writeFile } = await import('fs/promises');
  await writeFile(join(defaultDir, 'system-prompt.md'), '# Default Agent\n\nYou are a general-purpose coding assistant.');
  agentNames.push('default');
}

// Initialize tools
const stateStore = new StateStore();
const backgroundRunner = new BackgroundRunner(stateStore);
const askTool = new AskTool(stateStore, backgroundRunner);
const awaitTool = new AwaitTool(stateStore);
const haltTool = new HaltTool(stateStore);

const server = new Server(
  { name: 'autorun-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'ask',
      description: 'Ask a question to a subagent (hybrid: sync if <10s, async if >10s)',
      inputSchema: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            enum: agentNames,
            description: 'Agent type to use'
          },
          question: {
            type: 'string',
            description: 'Question to ask the agent'
          },
          async: {
            type: 'boolean',
            description: 'true=immediate token, false=wait for completion, undefined=hybrid'
          }
        },
        required: ['agentName', 'question']
      }
    },
    {
      name: 'await',
      description: 'Wait for async task completion (55s timeout)',
      inputSchema: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Task token from ask tool'
          }
        },
        required: ['token']
      }
    },
    {
      name: 'halt',
      description: 'Cancel a running task',
      inputSchema: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Task token to cancel'
          }
        },
        required: ['token']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'ask':
        result = await askTool.execute(args.agentName, args.question, { async: args.async });
        break;
      case 'await':
        result = await awaitTool.execute(args.token);
        break;
      case 'halt':
        result = await haltTool.execute(args.token);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
