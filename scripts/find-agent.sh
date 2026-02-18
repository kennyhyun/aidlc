#!/bin/bash

GITLAB_URL="https://gitlab.imaginetoolbox.com"

if [ -z "$GITLAB_RO_TOKEN" ]; then
    echo "❌ GITLAB_RO_TOKEN 필요"
    exit 1
fi

echo "🔍 모든 프로젝트에서 Agent 검색 중..."
echo ""

# k8s.env와 관련 프로젝트들 확인
for project_path in "whitech-group/infra/k8s.env" "whitech-group/infra" "whitech-group"; do
    project_id=$(echo "$project_path" | sed 's/\//%2F/g')
    echo "📁 $project_path:"
    agents=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
        "$GITLAB_URL/api/v4/projects/$project_id/cluster_agents")
    
    if [ "$agents" != "[]" ] && [ "$agents" != "null" ]; then
        echo "$agents" | jq -r '.[] | "  ✅ Agent ID: \(.id) | Name: \(.name) | Project: \(.project.path_with_namespace)"'
    else
        echo "  ❌ No agents"
    fi
    echo ""
done
