// 정규식 설명 및 검증

const regex = /^(?:\s|\x1B\[[^a-zA-Z]*[a-zA-Z])*>\s/;

console.log('=== 정규식 패턴 설명 ===\n');
console.log('/^(?:\\s|\\x1B\\[[^a-zA-Z]*[a-zA-Z])*>\\s/');
console.log('');
console.log('^             - 줄 시작');
console.log('(?:           - 비캡처 그룹 시작');
console.log('  \\s         - 공백 문자 (들여쓰기 허용)');
console.log('  |           - 또는');
console.log('  \\x1B       - ESC 문자 (ANSI 시작)');
console.log('  \\[         - 리터럴 [');
console.log('  [^a-zA-Z]*  - 알파벳이 아닌 문자 0개 이상 (숫자, ;, ? 등)');
console.log('  [a-zA-Z]    - 알파벳 1개 (ANSI 종료)');
console.log(')*            - 그룹 0회 이상 반복');
console.log('>             - 리터럴 >');
console.log('\\s           - 공백 문자 1개');
console.log('');

console.log('=== 테스트 케이스 ===\n');

const testCases = [
  // 성공 케이스
  { input: '> Hello', expected: true, desc: '기본 프롬프트' },
  { input: '\x1B[38;5;141m> \x1B[0mHello', expected: true, desc: 'ANSI 코드 포함' },
  { input: '\x1B[?25l\x1B[0m\x1B[38;5;141m> \x1B[0mNow let me', expected: true, desc: '여러 ANSI 코드' },
  { input: '  > Test', expected: true, desc: '앞에 공백' },
  
  // 실패 케이스
  { input: '>No space', expected: false, desc: '> 뒤 공백 없음' },
  { input: 'Text > with', expected: false, desc: '중간에 >' },
  { input: '>> Double', expected: false, desc: '>> 이중' },
  { input: 'No prompt here', expected: false, desc: '프롬프트 없음' },
];

testCases.forEach(({ input, expected, desc }) => {
  const result = regex.test(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${desc}`);
  console.log(`   입력: ${JSON.stringify(input)}`);
  console.log(`   예상: ${expected}, 결과: ${result}`);
  console.log('');
});

console.log('=== 실제 로그 라인 테스트 ===\n');

const realLogLines = [
  '\x1B[?25l\x1B[0m\x1B[38;5;141m> \x1B[0mNow let me create a summary document:\x1B[0m\x1B[0m',
  '> First response',
  'Some output line',
  '  > Indented prompt',
];

realLogLines.forEach((line, i) => {
  const match = regex.test(line);
  console.log(`Line ${i}: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
  console.log(`  ${JSON.stringify(line.substring(0, 60))}`);
  console.log('');
});
