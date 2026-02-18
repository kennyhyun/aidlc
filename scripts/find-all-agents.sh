#!/bin/bash

if [ -z "$GITLAB_RO_TOKEN" ]; then
  echo "Error: GITLAB_RO_TOKEN is not set"
  exit 1
fi

GITLAB_URL="https://gitlab.imaginetoolbox.com"
GROUP_ID="whitech-group"

echo "=== Searching for all Kubernetes agents in $GROUP_ID ==="
echo ""

# Get all projects in the group (including subgroups)
projects=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
  "$GITLAB_URL/api/v4/groups/$GROUP_ID/projects?include_subgroups=true&per_page=100" | \
  jq -r '.[] | "\(.id)|\(.path_with_namespace)"')

if [ -z "$projects" ]; then
  echo "No projects found or API error"
  exit 1
fi

found_agents=false

while IFS='|' read -r project_id project_path; do
  # Get agents for each project
  agents=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    "$GITLAB_URL/api/v4/projects/$project_id/cluster_agents" 2>/dev/null)
  
  if [ "$agents" != "[]" ] && [ -n "$agents" ]; then
    agent_count=$(echo "$agents" | jq '. | length')
    if [ "$agent_count" -gt 0 ]; then
      found_agents=true
      echo "📦 Project: $project_path"
      echo "   URL: $GITLAB_URL/$project_path/-/clusters"
      echo "$agents" | jq -r '.[] | "   🔧 Agent: \(.name) (ID: \(.id))\n      Config: $GITLAB_URL/'$project_path'/-/blob/\(.config_project.default_branch // "main")/.gitlab/agents/\(.name)/config.yaml"'
      echo ""
    fi
  fi
done <<< "$projects"

if [ "$found_agents" = false ]; then
  echo "No Kubernetes agents found in $GROUP_ID"
fi
