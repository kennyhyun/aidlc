#!/bin/bash

# Find the latest subagent log file and display it

source "$(dirname "$0")/env.sh"

# Parse options
FOLLOW=false
if [ "$1" = "-f" ]; then
  FOLLOW=true
fi

# Find the most recent .log file
SUBAGENT_DIR="$AIDLC_DIR/subagents"
# Use different commands for macOS and Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  LATEST_LOG=$(find "$SUBAGENT_DIR" -name "*.log" -type f -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
else
  # Linux
  LATEST_LOG=$(find "$SUBAGENT_DIR" -name "*.log" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
fi

if [ -z "$LATEST_LOG" ]; then
  echo "No subagent log files found in $SUBAGENT_DIR"
  exit 1
fi

echo "Latest log: $LATEST_LOG"
echo "---"

if [ "$FOLLOW" = true ]; then
  tail -fn30000 "$LATEST_LOG"
else
  cat "$LATEST_LOG"
fi
