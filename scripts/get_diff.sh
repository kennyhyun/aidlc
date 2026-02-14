#!/bin/bash
# Script to fetch MR diff and split files into chunks while preserving file entry integrity
# Each file entry (starting with ### filename) will be kept together in one output file

# Usage:
# ./get_diff.sh <MR_ID> [MAX_LINES_PER_FILE]
# Example: ./get_diff.sh 12 500

source "$(dirname "$0")/env.sh"

# Error handling
set -e

GITLAB_URL="${GITLAB_URL:-https://gitlab.example.com}"
GITLAB_MR_PROJECT_ID="${GITLAB_MR_PROJECT_ID:-5}"

# Check arguments
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <MR_ID> [MAX_LINES_PER_FILE]"
  echo "Example: $0 12 500"
  exit 1
fi

MR_ID=$1
MAX_LINES=${2:-500}  # Default to 500 lines per file

# Check required tools
for cmd in curl jq wc awk; do
  if ! command -v $cmd &> /dev/null; then
    echo "Error: Command '$cmd' not found. Please install it."
    exit 1
  fi
done

mkdir -p "$AIDLC_DIR/$MR_ID"
REVIEW_DIR="$AIDLC_DIR/$MR_ID"

echo "Fetching diff for MR !$MR_ID..."

# Check for GitLab token
if [ -z "$GITLAB_RO_TOKEN" ]; then
  echo "GITLAB_RO_TOKEN environment variable is not set."
  echo "Copy .env.example to .env and set your token"
  exit 1
fi

# Save MR changes to temporary file
TMP_FILE=$(mktemp)
TMP_RESPONSE=$(mktemp)

# Make the API call and save both headers and body
HTTP_CODE=$(curl -s -w "%{http_code}" -H "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
  "$GITLAB_URL/api/v4/projects/$GITLAB_MR_PROJECT_ID/merge_requests/$MR_ID/changes" \
  -o "$TMP_RESPONSE")

# Check HTTP response code
if [ "$HTTP_CODE" -eq 401 ]; then
  echo "Error: Unauthorized. Please check your GITLAB_RO_TOKEN."
  echo "Response:"
  cat "$TMP_RESPONSE"
  rm -f "$TMP_RESPONSE" "$TMP_FILE"
  exit 1
elif [ "$HTTP_CODE" -ne 200 ]; then
  echo "Error: GitLab API returned status code $HTTP_CODE"
  echo "Response:"
  cat "$TMP_RESPONSE"
  rm -f "$TMP_RESPONSE" "$TMP_FILE"
  exit 1
fi

# Check if response is valid JSON and has changes
if ! jq -e '.changes' "$TMP_RESPONSE" > /dev/null 2>&1; then
  echo "Error: Invalid response from GitLab API"
  echo "Response:"
  cat "$TMP_RESPONSE"
  rm -f "$TMP_RESPONSE" "$TMP_FILE"
  exit 1
fi

# Process the changes
jq -r '.changes[] | "### \(.new_path)\n\n\(.diff)\n"' "$TMP_RESPONSE" > "$TMP_FILE.raw"

# Wrap in diff code block
{
  echo '```diff'
  cat "$TMP_FILE.raw"
  echo '```'
} > "$TMP_FILE"
rm -f "$TMP_FILE.raw"

# Save complete diff file
cp "$TMP_FILE" "$REVIEW_DIR/diff.md"
TOTAL_LINES=$(wc -l < "$TMP_FILE")
echo "Complete diff file created: $REVIEW_DIR/diff.md ($TOTAL_LINES lines)"

# Cleanup response file
rm -f "$TMP_RESPONSE"

# Split file processing with strict line limits
echo "Splitting files into chunks (max $MAX_LINES lines per file)..."

# First, create a temporary file with entry line counts
awk '
BEGIN { entry_lines = 0; entry_start = 0 }
{
  if ($0 ~ /^### /) {
    if (entry_start > 0) {
      print entry_start, entry_lines
    }
    entry_start = NR
    entry_lines = 1
  } else {
    entry_lines++
  }
}
END {
  if (entry_lines > 0) {
    print entry_start, entry_lines
  }
}' "$TMP_FILE" > "$TMP_FILE.count"

# Now process the files with line counts information
awk -v max_lines="$MAX_LINES" -v review_dir="$REVIEW_DIR" -v count_file="$TMP_FILE.count" '
BEGIN {
  part = 1
  file = sprintf("%s/diff.%d.md", review_dir, part)
  lines_in_file = 0
  header_lines = 2  # Account for header and empty line
  content_limit = max_lines - header_lines  # Adjust limit for actual content
  
  # Read entry sizes first
  while ((getline line < count_file) > 0) {
    split(line, arr)
    entry_starts[arr[1]] = arr[2]  # line number -> size
  }
  close(count_file)
  
  print "<!-- Split diff file part " part " -->\n" > file
}

{
  if ($0 ~ /^### /) {
    entry_size = entry_starts[NR]
    
    # If this entry would exceed content limit, start new file
    if (lines_in_file > 0 && (lines_in_file + entry_size > content_limit)) {
      part++
      file = sprintf("%s/diff.%d.md", review_dir, part)
      print "<!-- Split diff file part " part " -->\n" > file
      lines_in_file = 0
    }
  }
  
  # Write current line
  print $0 >> file
  lines_in_file++
}
' "$TMP_FILE"

# Create split file index
{
  echo "# MR !$MR_ID Split Diff Files List"
  echo
  echo "Complete file: [diff.md](diff.md) ($TOTAL_LINES lines)"
  echo
  echo "## Split Files"
} > "$REVIEW_DIR/diff.index.md"

# Add split files to index with line counts
for f in "$REVIEW_DIR/diff."*.md; do
  if [[ "$f" != *"index.md" ]]; then
    lines=$(wc -l < "$f")
    base_name=$(basename "$f")
    echo "- [$base_name]($base_name) ($lines lines)" >> "$REVIEW_DIR/diff.index.md"
  fi
done

# Cleanup
rm -f "$TMP_FILE" "$TMP_FILE.count"

cat << EOF

Processing complete!
------------------------------------------------------
Complete diff file: $REVIEW_DIR/diff.md ($TOTAL_LINES lines)
Index file: $REVIEW_DIR/diff.index.md
------------------------------------------------------

Review steps:
1. Check the complete file list in diff.index.md
2. Review each split file to understand the changes
3. Create your review plan in $REVIEW_DIR/plan.md

EOF
