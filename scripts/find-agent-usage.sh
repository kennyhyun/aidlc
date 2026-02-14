#!/bin/bash

source "$(dirname "$0")/env.sh"

GITLAB_URL="${GITLAB_URL:-https://gitlab.example.com}"
GITLAB_GROUP_PATH="${GITLAB_GROUP_PATH:-your-group}"

if [ -z "$GITLAB_RO_TOKEN" ]; then
  echo "Error: GITLAB_RO_TOKEN is not set"
  echo "Copy .env.example to .env and set your token"
  exit 1
fi

TARGET_PROJECT="$1"

if [ -n "$TARGET_PROJECT" ]; then
  echo "=== Checking agent access for: $TARGET_PROJECT ==="
  echo ""
  all_projects="$TARGET_PROJECT"
else
  echo "=== Scanning all projects for agent access ==="
  echo ""
  
  all_projects=""
  page=1
  while true; do
    projects=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
      "$GITLAB_URL/api/v4/groups/$GITLAB_GROUP_PATH/projects?include_subgroups=true&per_page=100&page=$page" | \
      jq -r '.[] | "\(.path_with_namespace)"')
    
    [ -z "$projects" ] && break
    all_projects="$all_projects$projects
"
    page=$((page + 1))
  done
fi

while read -r project_path; do
  [ -z "$project_path" ] && continue
  
  result=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{"query": "{ project(fullPath: \"'$project_path'\") { clusterAgents { nodes { name } } ciAccessAuthorizedAgents { nodes { agent { name } } } } }"}' \
    "$GITLAB_URL/api/graphql")
  
  owned=$(echo "$result" | jq -r '.data.project.clusterAgents.nodes[].name' 2>/dev/null)
  ci_access=$(echo "$result" | jq -r '.data.project.ciAccessAuthorizedAgents.nodes[].agent.name' 2>/dev/null | sort -u)
  
  if [ -n "$owned" ] || [ -n "$ci_access" ]; then
    agents=$(echo -e "$owned\n$ci_access" | grep -v '^$' | sort -u | tr '\n' ', ' | sed 's/,$//')
    echo "$project_path → $agents"
  fi
done <<< "$all_projects"
