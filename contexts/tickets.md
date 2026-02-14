# JIRA Ticket Management Guide

See [JIRA Guide](aidlc/guidelines/jira.md) for authentication, scripts, and API usage.

## Workflow Overview

### 1. Fetch Ticket Information

Use `fetch-tickets.sh` to download ticket data and convert to readable format.
See [JIRA Guide](aidlc/guidelines/jira.md) for script usage details.

### 2. Create Documentation

Create ticket documentation structure:
- `docs/tickets/{type}/PREF-xxx_{summary}/readme.md` (type: epic/story/task)
- Store API results in `.files/` folder
- Use `jq` for JSON parsing (e.g., `.fields.subtasks` for subtasks)
- Collect summary and description for all child items
- For subtasks, create folder with ticket number inside parent task folder
- For epics, create child items in parent folder and add symlinks:
  ```bash
  # Example: Epic PREF-100 has story PREF-101
  cd docs/tickets/epic/PREF-100_epic-name/
  ln -s ../../story/PREF-101_story-name PREF-101
  ```
- Write readme in English
- Summarize child document readmes with clear, concise overview

### 3. Analyze Status (for epics)

Create `docs/tickets/epic/PREF-xxx_{summary}/status.md`:
- List each child item with: ticket number, type, summary, status
- Link sub-items to their readme.md files

### 4. Start Task Implementation

Start to create design document using `brainstorming` skill

### 5. Open Merge Request

Push branch and create MR on Gitlab.
- Don't include files changed (MR has it already)
- Exclude Related Tickets too
- See [Gitlab Guide](aidlc/guidelines/gitlab.md) for tokens and project IDs
- See [Testing Guide](aidlc/guidelines/automated.testing.md) for pipeline tests

