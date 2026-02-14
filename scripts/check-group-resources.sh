#!/bin/bash

source "$(dirname "$0")/env.sh"

GITLAB_URL="${GITLAB_URL:-https://gitlab.example.com}"
GITLAB_GROUP_PATH="${GITLAB_GROUP_PATH:-your-group%2Fyour-subgroup}"
GITLAB_GROUP_ID="${GITLAB_GROUP_ID:-85}"

if [ -z "$GITLAB_RO_TOKEN" ]; then
    echo "❌ GITLAB_RO_TOKEN 필요"
    exit 1
fi

echo "🔍 그룹 레벨 리소스 확인 중..."
echo ""

# 그룹 정보
echo "📁 그룹 정보:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/groups/$GITLAB_GROUP_PATH" | \
    jq '{id, name, full_path}'
echo ""

# 그룹의 Runners
echo "🏃 그룹 Runners:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RUNNERS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/groups/$GITLAB_GROUP_ID/runners")
if [ "$RUNNERS" != "[]" ]; then
    echo "$RUNNERS" | jq -r '.[] | "ID: \(.id) | \(.description) | Status: \(.status)"'
else
    echo "  ❌ No group runners"
fi
echo ""

