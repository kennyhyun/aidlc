# Gitlab Kubernetes runner/agent Guide

## Basic Information

Our Gitlab URL:

https://gitlab.imaginetoolbox.com/

Set up tokens in `.zshrc` or `.profile`:

```bash
export GITLAB_RO_TOKEN="your-personal-api-token"
```

## Agent 웹에서 확인하기

### prod-gitlab-eks-agent (권장)
- **Agent 설정**: https://gitlab.imaginetoolbox.com/whitech-group/infra/k8s.env/-/clusters
- **Config 파일**: https://gitlab.imaginetoolbox.com/whitech-group/infra/k8s.env/-/blob/main/.gitlab/agents/prod-gitlab-eks-agent/config.yaml
- **소유**: k8s.env 프로젝트 (인프라 전용 저장소)
- **공유 범위**: whitech-group/development/reimagine 그룹 전체

### 다른 프로젝트에서 보기:
- https://gitlab.imaginetoolbox.com/whitech-group/development/reimagine/<project-name>/-/clusters
- `prod-gitlab-eks-agent`가 "Shared from group"으로 표시됨

## 현재 상태 확인

### 스크립트 목록

**프로젝트/그룹 리소스 확인:**
```bash
# reimagine-admin 프로젝트의 Runners, imagine-online의 Agents, Runner 6885 상세 정보
./aidlc/scripts/check-gitlab-resources.sh

# reimagine 그룹 정보 및 그룹 레벨 Runners
./aidlc/scripts/check-group-resources.sh
```

**Agent 사용 현황 확인:**
```bash
# 모든 프로젝트의 agent 접근 권한 확인 (소유 + CI 접근)
# 출력: project-path → agent-name
./aidlc/scripts/find-agent-usage.sh
```

## How to use shared agent for deploying from the pipeline

### 1. Agent 공유 설정

`prod-gitlab-eks-agent`는 k8s.env 프로젝트에서 관리되며, reimagine 그룹 전체에 공유되어 있습니다.

**Config 파일 위치**: `k8s.env/.gitlab/agents/prod-gitlab-eks-agent/config.yaml` (main 브랜치)

**현재 설정:**
```yaml
ci_access:
  groups:
    - id: whitech-group/development/reimagine
```

**설정 변경 시**:
1. k8s.env 프로젝트의 main 브랜치에 config 파일 커밋
2. Agent가 자동으로 config 업데이트 (몇 분 소요)
3. 다른 프로젝트의 Clusters 페이지에서 "Shared from group" 확인

### 2. GitLab CI/CD 파이프라인에서 agent 사용

`.gitlab-ci.yml` 예시:

```yaml
deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config get-contexts
    - kubectl config use-context whitech-group/infra/k8s.env:prod-gitlab-eks-agent
    - kubectl apply -f k8s/deployment.yaml
  environment:
    name: production
    kubernetes:
      namespace: your-namespace
```

## How to use shared runner for pipeline runner

### 0. Runner 6885를 프로젝트에 할당

Runner 6885는 shared가 아니므로 프로젝트에 직접 할당 필요:

**방법 1: GitLab UI**
- Settings → CI/CD → Runners → Enable for this project
- Runner 6885 찾아서 활성화

**방법 2: API**
```bash
curl --request POST --header "PRIVATE-TOKEN: $GITLAB_RO_TOKEN" \
  "https://gitlab.imaginetoolbox.com/api/v4/projects/<project-id>/runners" \
  --data "runner_id=6885"
```

**Runner 6885 태그:**
`docker`, `dind`, `kiosk`, `localstack`, `linux`, `test`, `devel`, `deployment`, `backend`, `dashboard`, `event`, `light`

### 1. 프로젝트에서 shared runner 활성화

프로젝트 Settings → CI/CD → Runners에서 shared runner 활성화

### 2. `.gitlab-ci.yml` 설정

```yaml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

build:
  stage: build
  tags:
    - docker  # Runner 6885의 태그 사용
    - deployment
  image: node:18
  script:
    - yarn install
    - yarn build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:
  stage: deploy
  tags:
    - docker
    - deployment
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context whitech-group/infra/k8s.env:prod-gitlab-eks-agent
    - kubectl apply -f k8s/
  only:
    - main
    - develop
```

### 3. Runner 태그 확인

Runner 6885의 태그를 확인하고 `.gitlab-ci.yml`의 `tags`에 맞게 설정

### 4. Kubernetes 배포 매니페스트 준비

`k8s/deployment.yaml` 예시:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reimagine-admin
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: reimagine-admin
  template:
    metadata:
      labels:
        app: reimagine-admin
    spec:
      containers:
      - name: app
        image: your-registry/reimagine-admin:${CI_COMMIT_SHA}
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: reimagine-admin
  namespace: default
spec:
  selector:
    app: reimagine-admin
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```
