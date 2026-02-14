# aidlc

AI-driven development life cycle

## Purpose

To share the AI skills and standardise the process and procedures across the team


## Guidelines

- **Writing Documents**: Follow [contexts/docs.md](contexts/docs.md)
- **Code Conventions**: Follow [contexts/our.code.conventions.md](contexts/our.code.conventions.md)


## Usage

Symlink this repository as `aidlc` in other project roots (if not exist already):
This allows consistent access to guidelines and contexts across projects.

### Installing skills

Following 'Creating Links by OS' below,
Link aidlc\skills\superpowers\skills\* directories into your workspace's `skills` directory

### Injecting contexts

#### For Kiro

Following 'Creating Links by OS' below,
Link aidlc/contexts/our.code.conventions.md file into `.kiro/steering/`

### Troubleshooting

- Hard links broken? Your editor may recreate files on save. Use symbolic links instead.
- Permission denied on Windows? Run as administrator for `mklink /D`
- Links not working? Verify paths are correct and source files exist

### Creating Links by OS

When linking files or directories from this repository to other locations:

**Windows:**
- Use `mklink /J <link> <target>` for directory junctions

**macOS or Linux:**
- Use `cp -al <source> <destination>` for hard-linked copies

** Note: symlinks might not work with IDE tools like Kiro.

### Installing autorun mcp

autorun runs tasks using predefined prompts and provide the summary as a result.

- Run `npm i` in aidlc/mcp/autorun
- add mcp.json like aidlc/mcp/autorun/mcp-servers.json
- Connect the mcp

## Tips

### Skill Workflow

Complete development workflow:
1. **brainstorming** - Turn ideas into designs
2. **writing-plans** - Create implementation plan from design
3. **using-git-worktrees** - Set up isolated workspace (required)
4. Execute plan (choose one):
   - **subagent-driven-development** - Current session with per-task subagents
   - **executing-plans** - Separate session with batch execution
5. **finishing-a-development-branch** - Complete and integrate work

Always use during implementation:
- **test-driven-development** - Write tests first for all code
- **verification-before-completion** - Verify before claiming done
- **systematic-debugging** - Investigate bugs before fixing
- **requesting-code-review** / **receiving-code-review** - Review workflow

Special cases:
- **dispatching-parallel-agents** - Multiple independent problems
- **using-superpowers** - Start of any conversation
- **writing-skills** - Creating new skills

