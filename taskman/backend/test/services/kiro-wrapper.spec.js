const KiroWrapper = require('../../src/services/kiro-wrapper');

describe('KiroWrapper', () => {
  let wrapper;
  
  beforeEach(() => {
    wrapper = new KiroWrapper();
  });
  
  test('should execute command', async () => {
    const result = await wrapper.executeCommand({
      command: 'echo "test"',
      workdir: process.cwd(),
      timeout: 5
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('test');
  }, 10000);
});
