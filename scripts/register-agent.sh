#!/bin/bash

GITLAB_URL="https://gitlab.imaginetoolbox.com"
K8S_PROJECT_ID="184"
AGENT_NAME="gitlab-agent"

if [ -z "$GITLAB_TOKEN" ]; then
    echo "❌ GITLAB_TOKEN 환경변수 필요 (write 권한)"
    echo "export GITLAB_TOKEN='your-write-token'"
    exit 1
fi

echo "🔧 GitLab에 Agent 등록..."
echo ""

# 1. Agent 생성
echo "📝 Agent 생성 중..."
RESPONSE=$(curl -s --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$K8S_PROJECT_ID/cluster_agents" \
    --data "name=$AGENT_NAME")

echo "$RESPONSE" | jq .
AGENT_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$AGENT_ID" = "null" ]; then
    echo "❌ Agent 생성 실패"
    exit 1
fi

echo ""
echo "✅ Agent ID: $AGENT_ID"
echo ""

# 2. Token 생성
echo "🔑 Token 생성 중..."
TOKEN_RESPONSE=$(curl -s --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$K8S_PROJECT_ID/cluster_agents/$AGENT_ID/tokens" \
    --data "name=default-token")

echo "$TOKEN_RESPONSE" | jq .
NEW_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

echo ""
echo "✅ 새 토큰: $NEW_TOKEN"
echo ""
echo "📋 다음 단계:"
echo "1. Terraform 변수 업데이트:"
echo "   export TF_VAR_gitlab_token='$NEW_TOKEN'"
echo ""
echo "2. Terraform 재배포:"
echo "   cd environments/prod-eks-main/gitlab-agent"
echo "   terraform apply"
