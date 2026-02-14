#!/bin/bash

# 환경 설정 스크립트
# 다른 스크립트에서 source로 로드하여 사용
# Usage: source "$(dirname "$0")/env.sh"

# AIDLC_DIR과 PROJECT_DIR 자동 찾기
find_dirs() {
  local script_dir="$( cd "$( dirname "${BASH_SOURCE[1]}" )" && pwd )"
  local dir="$script_dir"
  local aidlc_dir=""
  local project_dir=""
  
  # 상위로 올라가며 .git 디렉토리 찾기
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/.git" ]; then
      # aidlc 디렉토리인지 확인
      if [[ "$dir" == */aidlc ]]; then
        aidlc_dir="$dir"
      else
        project_dir="$dir"
        break
      fi
    fi
    dir="$(dirname "$dir")"
  done
  
  # 환경변수 설정 (이미 설정되어 있으면 유지)
  export AIDLC_DIR="${AIDLC_DIR:-$aidlc_dir}"
  export PROJECT_DIR="${PROJECT_DIR:-$project_dir}"
  
  # AIDLC_DIR을 못 찾았지만 PROJECT_DIR을 찾았다면 추론
  if [ -z "$AIDLC_DIR" ] && [ -n "$PROJECT_DIR" ]; then
    if [ -d "$PROJECT_DIR/aidlc" ]; then
      export AIDLC_DIR="$PROJECT_DIR/aidlc"
    fi
  fi
  
  # SCRIPT_DIR도 export
  export SCRIPT_DIR="$script_dir"
}

# 환경변수 로드
load_env() {
  if [ -n "$AIDLC_DIR" ] && [ -f "$AIDLC_DIR/.env" ]; then
    set -a
    source "$AIDLC_DIR/.env"
    set +a
  fi
}

# 색상 정의
setup_colors() {
  export RED='\033[0;31m'
  export GREEN='\033[0;32m'
  export YELLOW='\033[1;33m'
  export BLUE='\033[0;34m'
  export CYAN='\033[0;36m'
  export NC='\033[0m' # No Color
}

# 초기화 (자동 실행)
init_common() {
  find_dirs
  load_env
  setup_colors
}

# 스크립트가 source될 때 자동 초기화
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
  init_common
fi
