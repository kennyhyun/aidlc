#!/bin/bash

# Convert Jira ADF description to readable text
# Usage: ./adf-to-text.sh <jira-json-file>

source "$(dirname "$0")/env.sh"

if [ -z "$1" ]; then
  echo "Usage: $0 <jira-json-file>"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Error: File '$1' not found"
  exit 1
fi

DIRNAME=$(dirname "$1")
BASENAME=$(basename "$1" .json)
OUTPUT_FILE="${DIRNAME}/${BASENAME}.md"

cat "$1" | jq -r '
def adf_to_text:
  if .type == "heading" then
    "\n" + ([range(.attrs.level)] | map("#") | join("")) + " " + (.content | map(select(.text) | .text) | join(""))
  elif .type == "paragraph" then
    (.content | map(
      if .text then .text
      elif .type == "hardBreak" then "\n"
      else ""
      end
    ) | join(""))
  elif .type == "taskList" then
    (.content | map(
      if .type == "taskItem" then
        "  " + (if .attrs.state == "DONE" then "☑" else "☐" end) + " " + 
        (.content | map(
          if .text then .text
          elif .type == "hardBreak" then "\n    "
          else ""
          end
        ) | join(""))
      else
        ""
      end
    ) | join("\n"))
  elif .type == "bulletList" then
    (.content | map(
      if .type == "listItem" then
        "  • " + (.content[0].content | map(.text // "") | join(""))
      else
        ""
      end
    ) | join("\n"))
  elif .type == "orderedList" then
    (.content | to_entries | map(
      "  " + (.key + 1 | tostring) + ". " + (.value.content[0].content | map(.text // "") | join(""))
    ) | join("\n"))
  elif .type == "codeBlock" then
    "```" + (.attrs.language // "") + "\n" + (.content[0].text // "") + "\n```"
  elif .type == "mediaSingle" then
    "[Image: " + (.content[0].attrs.alt // .content[0].attrs.id) + "]"
  else
    ""
  end;

def process_adf:
  if type == "string" then
    . | gsub("!(?<img>[^|!]+)\\|[^!]*!"; "![\(.img)]") 
      | gsub("h3\\. "; "### ") 
      | gsub("h2\\. "; "## ") 
      | gsub("h1\\. "; "# ")
      | gsub("\\*\\*(?<text>[^*]+)\\*\\*"; "**\(.text)**")
      | gsub("\\*(?<text>[^*]+)\\*"; "**\(.text)**")
      | gsub("\\{\\{(?<code>[^}]+)\\}\\}"; "`\(.code)`")
  elif type == "object" and .content then
    .content | map(adf_to_text) | join("\n")
  else
    ""
  end;

[
  "Key: " + .key,
  "Summary: " + .fields.summary,
  "Status: " + .fields.status.name,
  "Assignee: " + (.fields.assignee.displayName // "Unassigned"),
  "Reporter: " + .fields.reporter.displayName,
  "Created: " + .fields.created,
  "Updated: " + .fields.updated,
  "",
  "## Description",
  (.fields.description | process_adf),
  "",
  (if .subtasks | length > 0 then
    ["## Subtasks"] +
    (.subtasks | map(
      "- [" + .fields.status.name + "] " + .key + ": " + .fields.summary
    ))
  else
    []
  end),
  "",
  (if .fields.comment.comments | length > 0 then
    ["## Comments (" + (.fields.comment.comments | length | tostring) + ")"] +
    (.fields.comment.comments | map(
      "\n---\n" +
      "Author: " + .author.displayName + " (" + .created + ")\n" +
      (.body | process_adf)
    ))
  else
    []
  end)
] | flatten | join("\n")
' > "$OUTPUT_FILE"

echo "Converted: $1 -> $OUTPUT_FILE"
