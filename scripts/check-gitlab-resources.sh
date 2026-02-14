#!/bin/bash

source "$(dirname "$0")/env.sh"

GITLAB_URL="${GITLAB_URL:-https://gitlab.example.com}"
GITLAB_RUNNER_PROJECT_ID="${GITLAB_RUNNER_PROJECT_ID:-your-group%2Fyour-project}"
GITLAB_AGENT_PROJECT_ID="${GITLAB_AGENT_PROJECT_ID:-your-group%2Fyour-imagine-project}"

if [ -z "$GITLAB_RO_TOKEN" ]; then
    echo "❌ GITLAB_RO_TOKEN 환경변수가 설정되지 않았습니다."
    echo "Copy .env.example to .env and set your token"
    exit 1
fi

echo "🔍 GitLab 리소스 확인 중..."
echo ""

# 1. 프로젝트에서 사용 가능한 Runners 확인
echo "📦 사용 가능한 Runners:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RUNNERS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$GITLAB_RUNNER_PROJECT_ID/runners")
if [ "$RUNNERS" != "[]" ]; then
    echo "$RUNNERS" | jq -r '.[] | "ID: \(.id) | \(.description) | Tags: \(.tag_list | join(", ")) | Status: \(.status)"'
else
    echo "  ❌ No runners assigned"
fi
echo ""

# 2. imagine-online 프로젝트의 Agents 확인
echo "☸️  Project Agents:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
AGENTS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$GITLAB_AGENT_PROJECT_ID/cluster_agents")
if [ "$AGENTS" != "[]" ]; then
    echo "$AGENTS" | jq -r '.[] | "ID: \(.id) | Name: \(.name) | Created: \(.created_at)"'
else
    echo "  ❌ No agents"
fi
echo ""

# 3. Runner 상세 정보 (예시 - 실제 Runner ID로 변경 필요)
if [ -n "$GITLAB_RUNNER_ID" ]; then
    echo "🔎 Runner $GITLAB_RUNNER_ID 상세 정보:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
        "$GITLAB_URL/api/v4/runners/$GITLAB_RUNNER_ID" | \
        jq '{id, description, active, status, is_shared, tag_list, run_untagged, version}'
    echo ""
fi

