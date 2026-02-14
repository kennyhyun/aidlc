# JIRA Guide

## Setup

### Authentication

Set up tokens in `.zshrc` or `.profile`:

```bash
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token"
```

Check if the token is available. If not defined:

1. Run `source ~/.zshrc` and check again
2. If still missing, run `source ~/.profile`
3. If still unavailable, explain how to obtain and configure the token

### Windows Environment

For Windows env, use gitbash ("C:\Program Files\Git\bin\bash.exe" for running scripts)

## Scripts Usage

### Fetching Tickets

Use `fetch-tickets.sh` to download ticket and all related tickets (subtasks, linked issues):

Windows (after adding "C:\Program Files\Git\bin" to PATH):
```cmd
bash -c "cd <project-dir> && ./aidlc/scripts/fetch-tickets.sh PREF-xxxxx"
```

Unix/Linux/macOS:
```bash
./aidlc/scripts/fetch-tickets.sh PREF-xxxxx
```

This will:
- Auto-detect ticket type (epic/story/task)
- Create directory: `docs/tickets/{type}/PREF-xxx_{summary}/.files/`
- Download main ticket as `.files/PREF-xxx.json` (includes changelog)
- Download all subtasks and linked issues as `.files/PREF-yyy.json` (includes changelog)
- Convert all JSON files to markdown (`.md` files)

### Converting JSON to Markdown

```bash
./aidlc/scripts/adf-to-text.sh docs/tickets/{type}/PREF-xxx_{summary}/.files/PREF-xxxx.json
```

Creates: `docs/tickets/{type}/PREF-xxx_{summary}/.files/PREF-xxxx.md`

### Viewing Ticket History

View changelog with git-style diff:

```bash
python aidlc/scripts/jira-history-diff.py docs/tickets/{type}/PREF-xxx_{summary}/.files/PREF-xxxxx.json
```

Displays:
- **Cyan**: Timestamp and author
- **Yellow**: Field name (summary/description)
- **Red with red background**: Deleted content (word-level diff)
- **Green with green background**: Added content (word-level diff)
- Only changed lines shown

Example output:
```
=== 2026-02-02T23:14:24.970+1100 by Kenny Yeo ===
Field: description
- h2. Server job-monitor (rendering server)
+ h2. Server job-monitor
```

## Ticket Description Standards

Should match the ticket description, but:

- Don't include code examples or source filenames (they may change/not accurate)
- Don't include related ticket info (covered by other fields on the Jira)
- Add Implementation Notes as a simple list explaining tasks
- Better to have a PNG diagram

## Updating/Creating Jira Tickets

- update .files/{key}.md using fetch-tickets.sh script and
- copy .files/{key}.md as .files/{key}.update.md and change the content
- build a temporary file based on .files/{key}.json
- use curl to call Jira API using the temporary file

### ADF Formatting

Use taskList format for todo lists or success criteria.

Example:

```json
{
  "type": "taskList",
  "attrs": {"localId": "success-criteria"},
  "content": [
    {
      "type": "taskItem",
      "attrs": {"localId": "success-1", "state": "TODO"},
      "content": [
        {"type": "text", "text": "API accepts "},
        {"type": "text", "text": "supportsLocalRendering", "marks": [{"type": "code"}]},
        {"type": "text", "text": " parameter"}
      ]
    }
  ]
}
```
