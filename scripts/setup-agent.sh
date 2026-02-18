#!/bin/bash

GITLAB_URL="https://gitlab.imaginetoolbox.com"
K8S_PROJECT_ID="184"  # whitech-group/infra/k8s.env
AGENT_NAME="prod-eks-main"

if [ -z "$GITLAB_RO_TOKEN" ]; then
    echo "❌ GITLAB_RO_TOKEN 필요"
    exit 1
fi

echo "🔍 Agent 등록 및 확인..."
echo ""

# 1. 기존 Agent 확인
echo "📋 기존 Agents:"
AGENTS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$K8S_PROJECT_ID/cluster_agents")
echo "$AGENTS" | jq .

# 2. Agent가 없으면 생성 (읽기 전용 토큰으로는 불가능, 참고용)
echo ""
echo "📝 Agent 생성 명령 (write 권한 필요):"
echo "curl --request POST --header \"PRIVATE-TOKEN: \$GITLAB_TOKEN\" \\"
echo "  \"$GITLAB_URL/api/v4/projects/$K8S_PROJECT_ID/cluster_agents\" \\"
echo "  --data \"name=$AGENT_NAME\""
echo ""

# 3. Agent ID가 있으면 토큰 확인
AGENT_ID=$(echo "$AGENTS" | jq -r ".[0].id // empty")
if [ -n "$AGENT_ID" ]; then
    echo "🔑 Agent $AGENT_ID 토큰 목록:"
    curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
        "$GITLAB_URL/api/v4/projects/$K8S_PROJECT_ID/cluster_agents/$AGENT_ID/tokens" | jq .
fi
