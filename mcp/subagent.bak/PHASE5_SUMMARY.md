# Phase 5: await 툴 구현 완료

## 구현 내용

### 파일
- `src/await-tool.js`: await 툴 구현
- `src/await-tool.test.js`: 테스트 (8개 테스트 케이스)

### 주요 기능

1. **토큰 기반 상태 조회**
   - 유효하지 않은 토큰에 대해 에러 발생
   - StateStore에서 토큰으로 상태 조회

2. **55초 타임아웃 폴링**
   - 100ms 간격으로 상태 확인
   - 55초 후 타임아웃 시 현재 상태 반환
   - 완료 시 즉시 반환

3. **로그 파일 라인 수 카운팅**
   - 로그 파일 읽기 및 라인 수 계산
   - 빈 파일 처리 (0 반환)
   - 마지막 줄바꿈 여부 고려

4. **상태 응답 포맷**
   ```javascript
   {
     status: 'running' | 'completed' | 'failed',
     lineCount: number,
     timeout: boolean
   }
   ```

### 설계 특징

1. **의존성 주입**
   - `readFile` 함수를 생성자에서 주입받아 테스트 용이성 확보
   - 기본값으로 `fs/promises`의 `readFile` 사용

2. **비동기 폴링**
   - `pollUntilComplete` 메서드로 상태 변화 감지
   - `setInterval`과 `setTimeout` 조합으로 타임아웃 구현

3. **에러 처리**
   - 로그 파일 읽기 실패 시 0 반환 (graceful degradation)
   - 무효한 토큰에 대해 명확한 에러 메시지

## 테스트 결과

```
PASS src/await-tool.test.js
  Phase 5: await tool
    ✓ should throw error for invalid token
    ✓ should return immediately for completed task
    ✓ should return immediately for failed task
    ✓ should poll until completion within timeout
    ✓ should timeout after 55 seconds
    ✓ should count log file lines correctly
    ✓ should handle empty log file
    ✓ should handle log file without trailing newline

Tests:       8 passed, 8 total
```

### 커버리지
- Statements: 96.66%
- Branches: 78.57%
- Functions: 100%
- Lines: 96.55%

목표 80% 초과 달성 ✅

## 다음 단계

Phase 6: halt 툴 구현
- 프로세스 종료 로직 (SIGTERM → SIGKILL)
- 상태 업데이트 (cancelled)
- 메모리 정리
