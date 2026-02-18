#!/bin/bash

if [ -z "$GITLAB_RO_TOKEN" ]; then
  echo "Error: GITLAB_RO_TOKEN is not set"
  exit 1
fi

GITLAB_URL="https://gitlab.imaginetoolbox.com"
GROUP_ID="whitech-group"

echo "=== Finding all agents and their access configuration ==="
echo ""

projects=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
  "$GITLAB_URL/api/v4/groups/$GROUP_ID/projects?include_subgroups=true&per_page=100" | \
  jq -r '.[] | "\(.id)|\(.path_with_namespace)"')

while IFS='|' read -r project_id project_path; do
  agents=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$project_id/cluster_agents" 2>/dev/null)
  
  echo "$agents" | jq -c '.[]' 2>/dev/null | while read -r agent; do
    agent_name=$(echo "$agent" | jq -r '.name')
    agent_id=$(echo "$agent" | jq -r '.id')
    
    echo "🔧 Agent: $agent_name (ID: $agent_id)"
    echo "   Owner: $project_path"
    
    # Try to get config from different branches
    for branch in develop main master; do
      config=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
        "$GITLAB_URL/api/v4/projects/$project_id/repository/files/.gitlab%2Fagents%2F${agent_name}%2Fconfig.yaml/raw?ref=$branch" 2>/dev/null)
      
      if [ "$config" != '{"message":"404 File Not Found"}' ] && [ -n "$config" ]; then
        echo "   Config branch: $branch"
        echo "$config" | grep -A 10 "ci_access:" | sed 's/^/   /'
        break
      fi
    done
    echo ""
  done
done <<< "$projects"
