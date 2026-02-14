#!/bin/bash

# Convert Mermaid diagram to JPEG
# Usage: ./draw.sh <mermaid-file> [output-file]

source "$(dirname "$0")/env.sh"

set -e

MERMAID_FILE="$1"
OUTPUT_FILE="${2:-${MERMAID_FILE%.mmd}.png}"

if [ -z "$MERMAID_FILE" ]; then
  echo "Usage: $0 <mermaid-file> [output-file]"
  exit 1
fi

if [ ! -f "$MERMAID_FILE" ]; then
  echo "Error: File '$MERMAID_FILE' not found"
  exit 1
fi

# Check if mmdc is installed
if ! command -v mmdc &> /dev/null; then
  echo "Error: mermaid-cli not installed"
  echo "Install with: npm install -g @mermaid-js/mermaid-cli"
  exit 1
fi

# Convert to PNG
mmdc -i "$MERMAID_FILE" -o "$OUTPUT_FILE" -b transparent

echo "Generated: $OUTPUT_FILE"
