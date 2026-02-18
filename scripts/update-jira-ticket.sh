#!/bin/bash

# Update Jira ticket description from markdown file
# Usage: ./update-jira-ticket.sh <ticket-key> <update-md-file> [-DryRun]

source "$(dirname "$0")/env.sh"

# Parse arguments
DRY_RUN=false
TICKET_KEY=""
UPDATE_MD=""

for arg in "$@"; do
  case $arg in
    -DryRun)
      DRY_RUN=true
      shift
      ;;
    *)
      if [ -z "$TICKET_KEY" ]; then
        TICKET_KEY="$arg"
      elif [ -z "$UPDATE_MD" ]; then
        UPDATE_MD="$arg"
      fi
      shift
      ;;
  esac
done

if [ -z "$TICKET_KEY" ] || [ -z "$UPDATE_MD" ]; then
  echo "Usage: $0 <ticket-key> <update-md-file> [-DryRun]"
  echo "Example: $0 REI-15846 docs/tickets/bug/REI-15846_.../.files/REI-15846.update.md"
  echo "         $0 REI-15846 docs/tickets/bug/REI-15846_.../.files/REI-15846.update.md -DryRun"
  exit 1
fi

JIRA_URL="${JIRA_URL:-https://your-company.atlassian.net}"
JIRA_EMAIL="${JIRA_EMAIL:-your-email@example.com}"
JIRA_API_TOKEN="${JIRA_API_TOKEN:-your-jira-api-token}"

# Check for credentials
if [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_API_TOKEN" ] || [ "$JIRA_EMAIL" = "your-email@example.com" ]; then
  echo "Error: JIRA_EMAIL and JIRA_API_TOKEN must be set"
  exit 1
fi

if [ ! -f "$UPDATE_MD" ]; then
  echo "Error: Update file not found: $UPDATE_MD"
  exit 1
fi

echo "Updating $TICKET_KEY from $UPDATE_MD..."

# Convert markdown to ADF using Python script
ADF_JSON=$(python3 "$SCRIPT_DIR/md-to-adf.py" "$UPDATE_MD")

if [ $? -ne 0 ]; then
  echo "Error: Failed to convert markdown to ADF"
  exit 1
fi

# Create JSON payload
TEMP_JSON=$(mktemp)
cat > "$TEMP_JSON" <<EOF
{
  "fields": {
    "description": $ADF_JSON
  }
}
EOF

echo "Payload:"
cat "$TEMP_JSON" | jq .

# Update ticket
if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "=== DRY RUN MODE ==="
  echo "Would update ticket: $TICKET_KEY"
  echo "Jira URL: $JIRA_URL/rest/api/3/issue/$TICKET_KEY"
  echo "Payload size: $(cat "$TEMP_JSON" | wc -c) bytes"
  echo ""
  echo "✓ Dry run completed successfully"
  rm "$TEMP_JSON"
  exit 0
fi

echo ""
echo "Updating ticket..."
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d @"$TEMP_JSON" \
  "$JIRA_URL/rest/api/3/issue/$TICKET_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

rm "$TEMP_JSON"

if [ "$HTTP_CODE" = "204" ]; then
  echo "✓ Successfully updated $TICKET_KEY"
  exit 0
else
  echo "✗ Failed to update $TICKET_KEY (HTTP $HTTP_CODE)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
