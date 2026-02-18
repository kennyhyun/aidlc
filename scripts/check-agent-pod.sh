#!/bin/bash

echo "🔍 GitLab Agent Pod 정보 확인..."
echo ""

# Pod 환경변수 확인
echo "📋 Pod 환경변수 (KAS Address 등):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get po -n gitlab-agent gitlab-agent-v2-75d4767d74-c8nkw -o json | \
  jq -r '.spec.containers[0].env[] | "\(.name): \(.value // .valueFrom)"'
echo ""

# ConfigMap 확인
echo "🗂️  ConfigMap:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get cm -n gitlab-agent -o json | jq -r '.items[].data'
echo ""

# Secret 확인 (토큰)
echo "🔑 Secret (토큰 prefix만):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl get secret -n gitlab-agent -o json | \
  jq -r '.items[] | select(.data.token != null) | .data.token' | \
  base64 -d | cut -c1-20
echo ""

# Pod 로그에서 연결 정보 확인
echo "📝 Pod 로그 (연결 정보):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl logs -n gitlab-agent gitlab-agent-v2-75d4767d74-c8nkw --tail=50 | \
  grep -E "(agent_id|project|connected|configuration)" | head -10
echo ""

# Helm values 확인
echo "⚙️  Helm Release Values:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
helm get values gitlab-agent -n gitlab-agent
