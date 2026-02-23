# kiro-cli 세션 컨텍스트 관리 설계

**작성일:** 2026-02-23  
**상태:** 승인됨

## 개요

kiro-cli가 매번 새로운 대화 세션으로 실행되는 문제를 해결하여 대화 컨텍스트를 유지하고, 컨텍스트 크기를 표시하며, 필요 시 세션을 종료할 수 있도록 개선합니다.

## 문제 정의

현재 taskman/backend의 kiro-wrapper는 매번 `kiro-cli chat --no-interactive --trust-all-tools` 명령어를 실행하여 새로운 세션을 생성합니다. 이로 인해:

1. 이전 대화 내용을 기억하지 못함
2. 연속된 질문에 대한 컨텍스트 부족
3. 사용자가 컨텍스트 사용량을 알 수 없음
4. 세션을 명시적으로 종료할 방법이 없음

## 목표

1. **컨텍스트 유지**: 워크스페이스별로 대화 세션 유지
2. **컨텍스트 크기 표시**: Telegram 응답에 토큰 사용량 표시
3. **세션 종료**: `!bye` 명령어로 현재 세션 초기화
4. **워크스페이스 연동**: 워크스페이스 변경 시 자동 세션 전환

## 설계

### 1. 세션 유지 메커니즘

#### 1.1 kiro-cli --resume 플래그 사용

```bash
kiro-cli chat --no-interactive --trust-all-tools --resume
```

- kiro-cli는 workdir 기반으로 세션을 자동 저장
- 동일한 workdir에서 실행 시 이전 세션 자동 로드
- 워크스페이스별로 독립적인 세션 관리

#### 1.2 워크스페이스별 세션 격리

```
워크스페이스 A (/project/A) → 세션 A
워크스페이스 B (/project/B) → 세션 B
워크스페이스 A로 복귀 → 세션 A 재개
```

### 2. 컨텍스트 크기 표시

#### 2.1 토큰 정보 파싱

kiro-cli 출력(stdout/stderr)에서 토큰 사용량 추출:

```javascript
// 예상 출력 형식: "Token usage: 5000/20000"
const tokenMatch = output.match(/Token usage:\s*(\d+)\s*\/\s*(\d+)/i);
if (tokenMatch) {
  const used = parseInt(tokenMatch[1]);
  const total = parseInt(tokenMatch[2]);
  const percentage = Math.round((used / total) * 100);
}
```

#### 2.2 응답 포맷

```
[응답 내용]

[워크스페이스: /path/to/project]
[컨텍스트: 25% (5000/20000 토큰)]
```

### 3. 세션 종료 (!bye)

#### 3.1 명령어 감지

```javascript
if (message.trim() === '!bye') {
  await this.clearSession(workdir);
  return '세션이 종료되었습니다. 다음 대화는 새로운 세션으로 시작됩니다.';
}
```

#### 3.2 세션 초기화 방법

**Option 1: 세션 파일 삭제**
```javascript
const sessionPath = path.join(workdir, '.kiro', 'sessions');
// 세션 파일들 삭제
```

**Option 2: --new-session 플래그 사용**
```javascript
// 다음 실행 시 --new-session 플래그 추가
kiro-cli chat --new-session --no-interactive --trust-all-tools
```

### 4. 워크스페이스 변경 처리

#### 4.1 자동 세션 전환

워크스페이스 변경 시:
- 현재 세션은 자동 저장됨
- 새 워크스페이스의 세션으로 자동 전환
- 이전 워크스페이스로 복귀 시 세션 재개

#### 4.2 사용자 알림

```javascript
let message = `워크스페이스가 변경되었습니다: ${newPath}`;

if (oldWorkspace && oldWorkspace.path !== newPath) {
  message += `\n\n이전 워크스페이스(${oldWorkspace.path})의 세션은 보존되어 있습니다.`;
  message += `\n해당 워크스페이스로 돌아가면 대화를 이어갈 수 있습니다.`;
}
```

## 구현 상세

### KiroWrapper 클래스 수정

```javascript
class KiroWrapper {
  constructor(workspaceService = null) {
    this.workspaceService = workspaceService;
  }

  async chat(message, context = {}) {
    // 1. !bye 명령어 처리
    if (message.trim() === '!bye') {
      const workdir = this.workspaceService?.getWorkdirForKiro() || process.cwd();
      await this.clearSession(workdir);
      return '세션이 종료되었습니다. 다음 대화는 새로운 세션으로 시작됩니다.';
    }

    // 2. workdir 결정
    let workdir = process.cwd();
    if (this.workspaceService) {
      workdir = this.workspaceService.getWorkdirForKiro();
    }

    // 3. 프롬프트 생성
    const fullPrompt = this.buildPrompt(message, context);
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");

    // 4. kiro-cli 실행 (--resume 추가)
    const result = await this.executeCommand({
      command: `kiro-cli chat --no-interactive --trust-all-tools --resume '${escapedPrompt}'`,
      workdir: workdir,
      timeout: 60
    });

    if (result.code === 0) {
      // 5. ANSI 코드 제거
      const cleanOutput = stripAnsi(result.stdout.trim());
      
      // 6. 컨텍스트 정보 파싱
      const contextInfo = this.parseContextInfo(result.stdout + result.stderr);
      
      // 7. 응답 포맷팅
      return this.formatResponse(cleanOutput, contextInfo, workdir);
    } else {
      throw new Error(result.stderr || 'Kiro CLI failed');
    }
  }

  parseContextInfo(output) {
    const tokenMatch = output.match(/Token usage:\s*(\d+)\s*\/\s*(\d+)/i);
    if (tokenMatch) {
      const used = parseInt(tokenMatch[1]);
      const total = parseInt(tokenMatch[2]);
      const percentage = Math.round((used / total) * 100);
      return { used, total, percentage };
    }
    return null;
  }

  formatResponse(cleanOutput, contextInfo, workdir) {
    let response = cleanOutput;
    
    // 워크스페이스 정보 추가
    response += `\n\n[워크스페이스: ${workdir}]`;
    
    // 컨텍스트 정보 추가
    if (contextInfo) {
      response += `\n[컨텍스트: ${contextInfo.percentage}% (${contextInfo.used}/${contextInfo.total} 토큰)]`;
    }
    
    return response;
  }

  async clearSession(workdir) {
    const sessionPath = path.join(workdir, '.kiro', 'sessions');
    if (fs.existsSync(sessionPath)) {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        fs.unlinkSync(path.join(sessionPath, file));
      }
    }
  }

  buildPrompt(message, context) {
    const contextStr = JSON.stringify(context, null, 2);
    return `You are a task management assistant. Help the user with their request based on the following context.

Context:
${contextStr}

User message: ${message}

Instructions:
- If the user clearly wants to execute a task (e.g., "run X", "execute X", "X 실행해줘", "X 돌려줘"), respond with ONLY this JSON format:
  {"action": "execute", "task_id": "task-id-here"}
  
- If the user asks about task status, list, or information, provide a helpful response in Korean.

- If the user's intent is unclear, ask for clarification in Korean.

Respond in Korean for explanations, but use the JSON format for execution requests.`;
  }
}
```

## 데이터 흐름

### 시나리오 1: 기본 대화 유지

```
사용자: "빌드 실행해줘"
    ↓
KiroWrapper.chat()
    ↓
workdir = /project/A
    ↓
kiro-cli chat --resume (세션 A 로드)
    ↓
"빌드를 실행하겠습니다..."
[워크스페이스: /project/A]
[컨텍스트: 15% (3000/20000 토큰)]
    ↓
사용자: "결과 어때?"
    ↓
kiro-cli chat --resume (세션 A 이어짐, 이전 대화 기억)
    ↓
"빌드가 성공적으로 완료되었습니다..."
[워크스페이스: /project/A]
[컨텍스트: 22% (4400/20000 토큰)]
```

### 시나리오 2: 워크스페이스 변경

```
사용자: "!workspace /project/B"
    ↓
워크스페이스 변경
    ↓
"워크스페이스가 변경되었습니다: /project/B
이전 워크스페이스(/project/A)의 세션은 보존되어 있습니다."
    ↓
사용자: "테스트 실행해줘"
    ↓
workdir = /project/B
    ↓
kiro-cli chat --resume (세션 B 로드, 새 세션 또는 이전 B 세션)
    ↓
"테스트를 실행하겠습니다..."
[워크스페이스: /project/B]
[컨텍스트: 5% (1000/20000 토큰)]
```

### 시나리오 3: 세션 종료

```
사용자: "!bye"
    ↓
clearSession(/project/B)
    ↓
"세션이 종료되었습니다. 다음 대화는 새로운 세션으로 시작됩니다."
    ↓
사용자: "안녕"
    ↓
kiro-cli chat --resume (새 세션 시작, 이전 대화 없음)
    ↓
"안녕하세요! 무엇을 도와드릴까요?"
[워크스페이스: /project/B]
[컨텍스트: 2% (400/20000 토큰)]
```

## 에러 처리

1. **컨텍스트 정보 파싱 실패**
   - 로그에 경고 기록
   - 컨텍스트 정보 없이 응답만 반환

2. **세션 파일 삭제 실패**
   - 로그에 에러 기록
   - 사용자에게 에러 메시지 반환하지 않음
   - 다음 실행 시 자동으로 새 세션 시작

3. **workdir 없음**
   - process.cwd() 사용
   - 로그에 경고 기록

4. **kiro-cli 실행 실패**
   - 기존 에러 처리 유지
   - stderr 내용을 사용자에게 전달

## 테스트 계획

### 단위 테스트

1. `parseContextInfo()` - 토큰 정보 파싱
2. `formatResponse()` - 응답 포맷팅
3. `clearSession()` - 세션 파일 삭제
4. `!bye` 명령어 감지

### 통합 테스트

1. 기본 대화 유지 (연속 질문)
2. 워크스페이스 변경 후 세션 전환
3. 워크스페이스 복귀 시 세션 재개
4. `!bye` 명령어로 세션 종료
5. 컨텍스트 정보 표시

### 수동 테스트

1. Telegram 봇을 통한 실제 대화 테스트
2. 여러 워크스페이스 간 전환 테스트
3. 장시간 대화 후 컨텍스트 크기 확인

## 제약사항 및 고려사항

1. **kiro-cli 의존성**
   - kiro-cli가 `--resume` 플래그를 지원해야 함
   - 토큰 정보 출력 형식이 변경될 수 있음

2. **세션 저장 위치**
   - kiro-cli의 세션 저장 위치를 정확히 파악 필요
   - `.kiro/sessions` 경로가 변경될 수 있음

3. **동시성**
   - 동일 워크스페이스에서 여러 사용자가 동시에 대화 시 세션 충돌 가능
   - 현재는 단일 사용자 시나리오만 고려

4. **세션 크기**
   - 장시간 대화 시 세션 파일 크기 증가
   - 주기적인 세션 정리 메커니즘 필요할 수 있음

## 향후 개선 사항

1. **자동 세션 만료**
   - 일정 시간(예: 30분) 동안 대화 없으면 자동 종료
   - 타임스탬프 기반 세션 관리

2. **사용자별 세션 격리**
   - Telegram chat_id 기반 세션 관리
   - 여러 사용자가 동일 워크스페이스 사용 가능

3. **세션 요약**
   - 긴 대화 세션을 요약하여 컨텍스트 크기 감소
   - 중요한 정보만 유지

4. **세션 내보내기/가져오기**
   - 세션을 파일로 저장/복원
   - 팀원 간 세션 공유

## 참고 자료

- [kiro-cli 세션 관리 문서](https://kiro.dev/docs/cli/chat/session-management/)
- [kiro-cli 컨텍스트 관리](https://kiro.dev/docs/cli/chat/context/)
- taskman/backend/src/services/kiro-wrapper.js
- taskman/backend/src/services/workspace-service.js
