# Task Planning Guide

## Plan File (plan.md)

### Purpose
High-level approach and architecture overview for the ticket implementation.

### Content
- Add to ticket folder and enumerate necessary subtasks
- Once the plan takes shape, update `readme.md` accordingly
- List subtasks required
- Add confirmation checkbox at the end: `- [ ] Confirmed by: xxx`

### Guidelines
- Don't include code examples (put that in the tasks file instead if required)
- Don't include filename to create
  - Let developers choose filenames for new files or use existing files as needed
- Keep it simple as much as possible
- Focus on overall approach and architecture
- List what needs to be done, not how to do it

## Tasks File (tasks.N.md)

### Purpose
Implementation checklist with specific actions for each subtask.

### Naming
- Create tasks.1.md for the 1st subtask, tasks.2.md for the 2nd, and so on
- If subtask was not required, use `tasks.1.md` only

### Content
- Simple todo list for the implementation
- Add confirmation checkbox at the end: `- [ ] Confirmed by: xxx`

### Guidelines
- For implementation checklist
- Keep it as a simple list with tickbox
- Additional key information could be included as the second depth
- Code example could be attached at the bottom to elaborate the task
- Each task should be clear and specific (could include function names and or existing file paths, parameters)

### Test Items
- Should specify target function or endpoints for testing
- Should have a clear instruction to cover more than 80% of code coverage
- We don't test migrations in the pipeline, running is actually testing
