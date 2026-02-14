#!/bin/bash
# Compare original documentation with split documentation to verify content coverage
# Usage: compare-split-docs.sh <original-file> <new-docs-dir> [max-depth]

source "$(dirname "$0")/env.sh"

set -e

ORIGINAL="${1:-readme.org.md}"
DOCS_DIR="${2:-docs}"
MAX_DEPTH="${3:-1}"

if [ ! -f "$ORIGINAL" ]; then
    echo "Error: Original file '$ORIGINAL' not found"
    exit 1
fi

if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: Documentation directory '$DOCS_DIR' not found"
    exit 1
fi

echo "=== Content Coverage Analysis ==="
echo ""

# Extract all content sections from original
echo "Original sections:"
grep -E "^##? " "$ORIGINAL" | sed 's/^#* //' | sort
echo ""
echo "---"
echo ""

# Check each new doc with depth limit
find "$DOCS_DIR" -maxdepth "$MAX_DEPTH" \( -name "readme.md" -o -name "README.md" \) | sort | while read -r doc; do
    echo "Sections in $doc:"
    grep -E "^##? " "$doc" | sed 's/^#* //' | sort
    echo ""
done

echo "=== Key Content Check ==="
echo ""

# Extract key phrases from original (sections and important terms)
mapfile -t phrases < <(grep -E "^##? " "$ORIGINAL" | sed 's/^#* //')

for phrase in "${phrases[@]}"; do
    found=0
    # Check in all new docs including main README with depth limit
    for doc in README.md $(find "$DOCS_DIR" -maxdepth "$MAX_DEPTH" \( -name "readme.md" -o -name "README.md" \)); do
        if [ -f "$doc" ] && grep -qi "$phrase" "$doc" 2>/dev/null; then
            found=1
            break
        fi
    done
    
    if [ $found -eq 0 ]; then
        echo "⚠️  Missing: '$phrase'"
    fi
done

echo ""
echo "=== Code Block Comparison ==="
echo ""

# Count code blocks
orig_code=0
if grep -q '```' "$ORIGINAL" 2>/dev/null; then
    orig_code=$(grep -c '```' "$ORIGINAL")
fi

new_code=0

if [ -f "README.md" ] && grep -q '```' "README.md" 2>/dev/null; then
    count=$(grep -c '```' "README.md")
    new_code=$((new_code + count))
fi

while IFS= read -r doc; do
    if grep -q '```' "$doc" 2>/dev/null; then
        count=$(grep -c '```' "$doc")
        new_code=$((new_code + count))
    fi
done < <(find "$DOCS_DIR" -maxdepth "$MAX_DEPTH" \( -name "readme.md" -o -name "README.md" \) 2>/dev/null)

echo "Original: $((orig_code / 2)) code blocks"
echo "New docs: $((new_code / 2)) code blocks"

echo ""
echo "=== Diagram Comparison ==="
echo ""

# Count mermaid diagrams
orig_mermaid=0
if grep -q '```mermaid' "$ORIGINAL" 2>/dev/null; then
    orig_mermaid=$(grep -c '```mermaid' "$ORIGINAL")
fi

new_mermaid=0

if [ -f "README.md" ] && grep -q '```mermaid' "README.md" 2>/dev/null; then
    count=$(grep -c '```mermaid' "README.md")
    new_mermaid=$((new_mermaid + count))
fi

while IFS= read -r doc; do
    if grep -q '```mermaid' "$doc" 2>/dev/null; then
        count=$(grep -c '```mermaid' "$doc")
        new_mermaid=$((new_mermaid + count))
    fi
done < <(find "$DOCS_DIR" -maxdepth "$MAX_DEPTH" \( -name "readme.md" -o -name "README.md" \) 2>/dev/null)

echo "Original: $orig_mermaid mermaid diagrams"
echo "New docs: $new_mermaid mermaid diagrams"

echo ""
echo "=== Summary ==="
echo ""

if [ $((orig_code / 2)) -eq $((new_code / 2)) ] && [ "$orig_mermaid" -eq "$new_mermaid" ]; then
    echo "✅ All code blocks and diagrams preserved"
else
    echo "⚠️  Code blocks or diagrams count mismatch"
fi
