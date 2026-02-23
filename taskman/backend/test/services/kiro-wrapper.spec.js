const KiroWrapper = require('../../src/services/kiro-wrapper');

describe('KiroWrapper', () => {
  let wrapper;
  
  beforeEach(() => {
    wrapper = new KiroWrapper();
  });
  
  describe('executeCommand', () => {
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
  
  describe('chat', () => {
    test('should strip ANSI codes from kiro-cli output', async () => {
      // Simulate LLM response with ANSI color codes (like kiro-cli output)
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '\x1b[32m{"action": "execute", "task_id": "build-backend"}\x1b[0m\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('빌드 실행해줘');
      
      // Should strip ANSI codes and return clean JSON
      expect(result).toBe('{"action": "execute", "task_id": "build-backend"}');
      expect(result).not.toContain('\x1b[');
    });
    
    test('should handle multi-line output with ANSI codes', async () => {
      // Simulate formatted LLM response with colors
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '\x1b[1m\x1b[36m현재 실행 중인 태스크:\x1b[0m\n\x1b[32m- build-backend\x1b[0m\n\x1b[33m- test-frontend\x1b[0m\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('상태 알려줘');
      
      // Should strip all ANSI codes
      expect(result).toContain('현재 실행 중인 태스크:');
      expect(result).toContain('- build-backend');
      expect(result).toContain('- test-frontend');
      expect(result).not.toContain('\x1b[');
    });
    
    test('should handle plain text output without ANSI codes', async () => {
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '태스크가 성공적으로 완료되었습니다.\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('결과 알려줘');
      
      expect(result).toBe('태스크가 성공적으로 완료되었습니다.');
    });
    
    test('should use workspace workdir when available', async () => {
      const mockWorkspaceService = {
        getWorkdirForKiro: jest.fn().mockReturnValue('/test/workspace')
      };
      
      wrapper = new KiroWrapper(mockWorkspaceService);
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'OK\n',
        stderr: ''
      });
      
      await wrapper.chat('test');
      
      expect(mockWorkspaceService.getWorkdirForKiro).toHaveBeenCalled();
      expect(wrapper.executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          workdir: '/test/workspace'
        })
      );
    });
    
    test('should handle kiro-cli errors', async () => {
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: 'Error: Command not found'
      });
      
      await expect(wrapper.chat('test')).rejects.toThrow('Error: Command not found');
    });
  });
});
