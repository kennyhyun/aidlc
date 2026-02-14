#!/bin/bash

# Fetch Jira ticket and all related tickets (subtasks, linked issues)
# Usage: ./fetch-tickets.sh PROJ-xxxxx

source "$(dirname "$0")/env.sh"

if [ -z "$1" ]; then
  echo "Usage: $0 PROJ-xxxxx"
  exit 1
fi

TICKET_KEY="$1"

JIRA_URL="${JIRA_URL:-https://your-company.atlassian.net}"
JIRA_EMAIL="${JIRA_EMAIL:-your-email@example.com}"
JIRA_API_TOKEN="${JIRA_API_TOKEN:-your-jira-api-token}"

# Check for credentials
if [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_API_TOKEN" ] || [ "$JIRA_EMAIL" = "your-email@example.com" ]; then
  echo "Error: JIRA_EMAIL and JIRA_API_TOKEN must be set in .env file"
  echo "Copy .env.example to .env and configure your credentials"
  exit 1
fi

echo "Fetching $TICKET_KEY..."

# Fetch main ticket with changelog in one call
TEMP_JSON="/tmp/$TICKET_KEY.json"
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$JIRA_URL/rest/api/3/issue/$TICKET_KEY?expand=changelog" \
  > "$TEMP_JSON"

if [ $? -ne 0 ]; then
  echo "Error fetching $TICKET_KEY"
  exit 1
fi

# Detect ticket type
TICKET_TYPE=$(jq -r '.fields.issuetype.name' "$TEMP_JSON" | tr '[:upper:]' '[:lower:]')
SUMMARY=$(jq -r '.fields.summary' "$TEMP_JSON" | sed 's/[^a-zA-Z0-9 ]//g' | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

# Create directory structure
TICKET_DIR="$PROJECT_DIR/docs/tickets/$TICKET_TYPE/${TICKET_KEY}_${SUMMARY}"
FILES_DIR="$TICKET_DIR/.files"

mkdir -p "$FILES_DIR"

# Save main ticket (full data with changelog)
cp "$TEMP_JSON" "$FILES_DIR/$TICKET_KEY.json"
echo "Saved $FILES_DIR/$TICKET_KEY.json"

# Convert to markdown
"$SCRIPT_DIR/adf-to-text.sh" "$FILES_DIR/$TICKET_KEY.json"
echo "Created $FILES_DIR/$TICKET_KEY.md"

# Fetch subtasks
SUBTASK_KEYS=$(jq -r '.fields.subtasks[]?.key // empty' "$FILES_DIR/$TICKET_KEY.json" | tr -d '\r')

if [ -n "$SUBTASK_KEYS" ]; then
  echo "Found subtasks: $SUBTASK_KEYS"
  for KEY in $SUBTASK_KEYS; do
    echo "Fetching $KEY..."
    curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
      -H "Content-Type: application/json" \
      "$JIRA_URL/rest/api/3/issue/$KEY?expand=changelog" \
      > "$FILES_DIR/$KEY.json"
    
    "$SCRIPT_DIR/adf-to-text.sh" "$FILES_DIR/$KEY.json"
    echo "Created $FILES_DIR/$KEY.json and $FILES_DIR/$KEY.md"
  done
fi

# Fetch linked issues
LINKED_KEYS=$(jq -r '.fields.issuelinks[]? | select(.outwardIssue or .inwardIssue) | (.outwardIssue.key // .inwardIssue.key)' "$FILES_DIR/$TICKET_KEY.json" | tr -d '\r')

if [ -n "$LINKED_KEYS" ]; then
  echo "Found linked issues: $LINKED_KEYS"
  for KEY in $LINKED_KEYS; do
    echo "Fetching $KEY..."
    curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
      -H "Content-Type: application/json" \
      "$JIRA_URL/rest/api/3/issue/$KEY?expand=changelog" \
      > "$FILES_DIR/$KEY.json"
    
    "$SCRIPT_DIR/adf-to-text.sh" "$FILES_DIR/$KEY.json"
    echo "Created $FILES_DIR/$KEY.json and $FILES_DIR/$KEY.md"
  done
fi

echo ""
echo "Done! Files saved to: $TICKET_DIR"
echo ""
echo "To view history diff:"
echo "  python aidlc/scripts/jira-history-diff.py $FILES_DIR/$TICKET_KEY.json"

