# Workspace Switcher Design

## Overview

워크스페이스 전환 기능을 taskman 백엔드에 추가하여 사용자가 여러 프로젝트 디렉토리를 관리하고 전환할 수 있도록 합니다. Telegram/Slack 챗봇 명령어와 REST API를 통해 접근 가능하며, Kiro CLI 실행 시 현재 워크스페이스를 자동으로 사용합니다.

## Goals

- 챗봇 명령어(`!workspace`)로 워크스페이스 조회 및 전환
- REST API로 워크스페이스 관리
- 현재/디폴트 워크스페이스 설정 및 저장
- 워크스페이스 히스토리 영구 보관 (접근 횟수, 마지막 접근 시간)
- Kiro CLI 실행 시 현재 워크스페이스의 디렉토리 사용

## Non-Goals

- 워크스페이스별 task 필터링
- 워크스페이스별 실행 히스토리 조회
- 워크스페이스 전환 시 task workdir 자동 변환
- 읽기/쓰기 권한 검증 (폴더 존재 여부만 확인)

## Database Schema

```sql
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  name TEXT,
  is_current BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 1
);
```

**설계 포인트:**
- `path`: 워크스페이스 절대 경로 (UNIQUE)
- `name`: 사용자 정의 별칭 (선택적)
- `is_current`: 현재 워크스페이스 (최대 1개)
- `is_default`: 디폴트 워크스페이스 (최대 1개)
- `access_count`: 접근 횟수 (자주 사용하는 워크스페이스 파악)
- `last_accessed_at`: 마지막 접근 시간

## API Endpoints

### GET /api/workspace
현재 워크스페이스 조회

**Response:**
```json
{
  "id": 1,
  "path": "/path/to/current",
  "name": "My Project",
  "access_count": 5,
  "last_accessed_at": "2026-02-22T10:30:00Z"
}
```

### POST /api/workspace/switch
워크스페이스 전환

**Request:**
```json
{
  "path": "/new/path"
}
```

**Response:**
```json
{
  "success": true,
  "workspace": {
    "id": 2,
    "path": "/new/path",
    "name": null,
    "access_count": 1
  }
}
```

**Errors:**
- 400: 폴더가 존재하지 않음
- 400: 경로가 폴더가 아님

### POST /api/workspace/default
디폴트 워크스페이스 설정

**Request:**
```json
{
  "path": "/default/path"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/workspace/default
디폴트 워크스페이스 조회

**Response:**
```json
{
  "id": 3,
  "path": "/default/path",
  "name": "Default Project"
}
```

### GET /api/workspace/list
워크스페이스 목록 (최근 사용 순)

**Query Parameters:**
- `limit`: 결과 개수 (기본값: 10)

**Response:**
```json
{
  "workspaces": [
    {
      "id": 1,
      "path": "/path/to/workspace1",
      "name": "Project A",
      "is_current": true,
      "is_default": false,
      "access_count": 10,
      "last_accessed_at": "2026-02-22T10:30:00Z"
    }
  ],
  "total": 25
}
```

### DELETE /api/workspace/:id
워크스페이스 히스토리 삭제

**Response:**
```json
{
  "success": true
}
```

## Chatbot Commands

```
!workspace                    → 현재 워크스페이스 표시
!workspace <경로>             → 워크스페이스 전환
!workspace list               → 최근 워크스페이스 목록
!workspace default            → 디폴트로 전환
!workspace default <경로>     → 디폴트 설정
```

**응답 포맷:**
- 성공: `✅ 워크스페이스 전환: /path/to/workspace`
- 실패: `❌ 폴더를 찾을 수 없습니다: /invalid/path`
- 목록: 최근 5개 워크스페이스 표시

## Service Layer

### WorkspaceService

```javascript
class WorkspaceService {
  constructor(db, taskManager) {
    this.db = db;
    this.taskManager = taskManager;
    this.initDatabase();
  }

  // 현재 워크스페이스 조회
  getCurrentWorkspace()

  // 워크스페이스 전환 (트랜잭션)
  switchWorkspace(path)

  // 디폴트 워크스페이스 설정 (트랜잭션)
  setDefaultWorkspace(path)

  // 디폴트 워크스페이스 조회
  getDefaultWorkspace()

  // 디폴트로 전환 (트랜잭션)
  switchToDefault()

  // 워크스페이스 목록 (최근 사용 순)
  listWorkspaces(limit = 10)

  // 워크스페이스 히스토리 삭제
  deleteWorkspace(id)

  // Kiro CLI용 workdir 결정
  getWorkdirForKiro()

  // 디폴트 워크스페이스 보장 (서버 시작 시 호출)
  ensureDefaultWorkspace()

  // 경로 검증 (폴더 존재 확인)
  _validatePath(path)

  // task 목록에서 존재하는 workdir 찾기
  _findExistingTaskWorkdir()
}
```

## Core Logic

### 워크스페이스 전환 (switchWorkspace)

```javascript
// 트랜잭션 시작
1. 경로 검증 (_validatePath)
2. 기존 is_current = 1 → 0으로 변경
3. 새 워크스페이스 INSERT or UPDATE
   - 존재하면: is_current = 1, access_count++, last_accessed_at 업데이트
   - 없으면: 새 레코드 생성 (is_current = 1)
// 트랜잭션 커밋
```

### 디폴트 설정 (setDefaultWorkspace)

```javascript
// 트랜잭션 시작
1. 경로 검증 (_validatePath)
2. 기존 is_default = 1 → 0으로 변경
3. 새 워크스페이스 INSERT or UPDATE
   - 존재하면: is_default = 1
   - 없으면: 새 레코드 생성 (is_default = 1)
// 트랜잭션 커밋
```

### Kiro CLI workdir 결정 (getWorkdirForKiro)

```javascript
1. current 워크스페이스 조회 → 경로 존재 확인 → 있으면 반환
2. 없으면 default 워크스페이스 조회 → 경로 존재 확인 → 있으면 반환
3. 둘 다 없으면 ensureDefaultWorkspace() 호출 → default 반환
```

### 디폴트 보장 (ensureDefaultWorkspace)

```javascript
// default가 없거나 존재하지 않을 때 실행
1. current가 있고 존재하면 → default로 DB 설정
2. 없으면 _findExistingTaskWorkdir() 호출
   → 존재하는 첫 번째 디렉토리를 default로 DB 설정
3. 그것도 없으면 process.cwd() → default로 DB 설정
```

### Task workdir 찾기 (_findExistingTaskWorkdir)

```javascript
// executions 테이블에서 최근 실행 순으로 task 조회
// 각 task의 workdir 존재 확인
// 존재하는 첫 번째 반환
```

## Kiro CLI Integration

### KiroWrapper 수정

```javascript
class KiroWrapper {
  constructor(workspaceService) {
    this.workspaceService = workspaceService;
  }

  async chat(message, context = {}) {
    // 현재 워크스페이스 조회
    const workdir = this.workspaceService.getWorkdirForKiro();
    
    logger.debug(`kiro-wrapper/chat:: Using workdir: ${workdir}`);
    
    const result = await this.executeCommand({
      command: `kiro-cli chat --no-interactive --trust-all-tools '${escapedPrompt}'`,
      workdir: workdir,
      timeout: 60
    });
    
    // ... 나머지 코드
  }
}
```

## Error Handling

```javascript
// 폴더가 존재하지 않음
{ code: 'WORKSPACE_NOT_FOUND', message: '폴더를 찾을 수 없습니다' }
→ 400 Bad Request

// 경로가 폴더가 아님 (파일)
{ code: 'WORKSPACE_NOT_DIRECTORY', message: '유효한 폴더가 아닙니다' }
→ 400 Bad Request

// 디폴트 워크스페이스가 설정되지 않음
{ code: 'NO_DEFAULT_WORKSPACE', message: '디폴트 워크스페이스가 설정되지 않았습니다' }
→ 404 Not Found

// 현재 워크스페이스가 없음
getCurrentWorkspace() → null 반환 (에러 아님)

// DB 오류
{ code: 'DATABASE_ERROR', message: 'DB 작업 실패' }
→ 500 Internal Server Error
```

## Testing Strategy

### workspace-service.spec.js

**기본 기능:**
- getCurrentWorkspace() - 현재 워크스페이스 조회
- switchWorkspace() - 워크스페이스 전환 성공
- setDefaultWorkspace() - 디폴트 설정
- getDefaultWorkspace() - 디폴트 조회
- switchToDefault() - 디폴트로 전환
- listWorkspaces() - 목록 조회 (최근 순)
- getWorkdirForKiro() - Kiro CLI workdir 결정
- ensureDefaultWorkspace() - 디폴트 자동 설정

**에러 케이스:**
- switchWorkspace() - 존재하지 않는 폴더
- switchWorkspace() - 파일 경로 (폴더 아님)
- switchToDefault() - 디폴트 미설정

**히스토리 관리:**
- access_count 증가 확인
- last_accessed_at 업데이트 확인
- 중복 경로 처리 (UNIQUE 제약)

**트랜잭션:**
- switchWorkspace() - 중간 실패 시 롤백
- setDefaultWorkspace() - 중간 실패 시 롤백

**Kiro CLI 통합:**
- getWorkdirForKiro() - current 사용
- getWorkdirForKiro() - default 폴백
- getWorkdirForKiro() - ensureDefaultWorkspace 호출

### workspace.spec.js

- API 엔드포인트 테스트 (각 route별)

**테스트 환경:**
- 인메모리 SQLite (`:memory:`)
- 각 테스트마다 DB 초기화
- 실제 파일시스템 사용 (임시 디렉토리 생성/삭제)

## Implementation Files

```
taskman/backend/
├── src/
│   ├── services/
│   │   ├── workspace-service.js      (NEW)
│   │   ├── kiro-wrapper.js           (MODIFY)
│   │   └── messaging-service.js      (MODIFY)
│   ├── routes/
│   │   └── workspace.js              (NEW)
│   └── models/
│       └── database.js               (MODIFY - add workspaces table)
└── test/
    ├── services/
    │   └── workspace-service.spec.js (NEW)
    └── routes/
        └── workspace.spec.js         (NEW)
```

## Architecture

```
┌─────────────────────────────────────┐
│      Telegram/Slack Bot             │
│      REST API Client                │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────────┐
│  Messaging  │  │   Workspace    │
│   Service   │  │    Routes      │
└──────┬──────┘  └─────┬──────────┘
       │                │
       └────────┬───────┘
                │
        ┌───────▼────────┐
        │   Workspace    │
        │    Service     │
        │                │
        │ - DB 관리      │
        │ - 경로 검증    │
        │ - 히스토리     │
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  Kiro Wrapper  │
        │                │
        │ - workdir 결정 │
        │ - CLI 실행     │
        └────────────────┘
```

## Future Enhancements

- 워크스페이스별 별칭 관리
- 워크스페이스 그룹 기능
- 워크스페이스별 환경변수 설정
- 워크스페이스 자동 완성
- 워크스페이스 전환 시 특정 파일 자동 열기
