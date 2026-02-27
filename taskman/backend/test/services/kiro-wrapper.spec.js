const KiroWrapper = require('../../src/services/kiro-wrapper');
const fs = require('fs');
const path = require('path');

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
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '\x1b[32m{"action": "execute", "task_id": "build-backend"}\x1b[0m\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('빌드 실행해줘');
      
      // Should strip ANSI codes and return clean JSON with workspace info
      expect(result).toContain('{"action": "execute", "task_id": "build-backend"}');
      expect(result).toContain('[워크스페이스:');
      expect(result).not.toContain('\x1b[');
    });
    
    test('should handle multi-line output with ANSI codes', async () => {
      // Simulate formatted LLM response with colors
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
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
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '태스크가 성공적으로 완료되었습니다.\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('결과 알려줘');
      
      expect(result).toContain('태스크가 성공적으로 완료되었습니다.');
      expect(result).toContain('[워크스페이스:');
    });
    
    test('should use workspace workdir when available', async () => {
      const mockWorkspaceService = {
        getWorkdirForKiro: jest.fn().mockReturnValue('/test/workspace')
      };
      
      wrapper = new KiroWrapper(mockWorkspaceService);
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'OK\n',
        stderr: ''
      });
      
      await wrapper.chat('test');
      
      expect(mockWorkspaceService.getWorkdirForKiro).toHaveBeenCalled();
      expect(wrapper.executeCommandWithStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          workdir: '/test/workspace'
        })
      );
    });
    
    test('should handle kiro-cli errors', async () => {
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 1,
        stdout: '',
        stderr: 'Error: Command not found'
      });
      
      await expect(wrapper.chat('test')).rejects.toThrow('Error: Command not found');
    });
    
    test('should call onProgress callback with streaming output', async () => {
      const onProgress = jest.fn();
      
      wrapper.executeCommandWithStreaming = jest.fn().mockImplementation(async ({ onProgress: callback }) => {
        // Simulate streaming output
        if (callback) {
          callback('First line');
          callback('Second line');
        }
        return {
          code: 0,
          stdout: 'First line\nSecond line\n',
          stderr: ''
        };
      });
      
      await wrapper.chat('test', {}, onProgress);
      
      expect(onProgress).toHaveBeenCalledWith('First line');
      expect(onProgress).toHaveBeenCalledWith('Second line');
    });
  });
  
  describe('parseContextInfo', () => {
    test('should parse token usage from output', () => {
      const wrapper = new KiroWrapper();
      const output = 'Some output\nToken usage: 5000/20000\nMore output';
      
      const result = wrapper.parseContextInfo(output);
      
      expect(result).toEqual({
        used: 5000,
        total: 20000,
        percentage: 25
      });
    });
    
    test('should handle case-insensitive token usage', () => {
      const wrapper = new KiroWrapper();
      const output = 'token USAGE: 10000 / 40000';
      
      const result = wrapper.parseContextInfo(output);
      
      expect(result).toEqual({
        used: 10000,
        total: 40000,
        percentage: 25
      });
    });
    
    test('should return null when no token info found', () => {
      const wrapper = new KiroWrapper();
      const output = 'No token information here';
      
      const result = wrapper.parseContextInfo(output);
      
      expect(result).toBeNull();
    });
    
    test('should round percentage correctly', () => {
      const wrapper = new KiroWrapper();
      const output = 'Token usage: 3333/10000';
      
      const result = wrapper.parseContextInfo(output);
      
      expect(result.percentage).toBe(33);
    });
  });
  
  describe('formatResponse', () => {
    test('should format response with workspace and context info', () => {
      const wrapper = new KiroWrapper();
      const cleanOutput = '빌드를 실행하겠습니다.';
      const contextInfo = { used: 5000, total: 20000, percentage: 25 };
      const workdir = '/project/A';
      
      const result = wrapper.formatResponse(cleanOutput, contextInfo, workdir);
      
      expect(result).toContain('빌드를 실행하겠습니다.');
      expect(result).toContain('[워크스페이스: /project/A]');
      expect(result).toContain('[컨텍스트: 25% (5000/20000 토큰)]');
    });
    
    test('should format response without context info when null', () => {
      const wrapper = new KiroWrapper();
      const cleanOutput = '안녕하세요';
      const contextInfo = null;
      const workdir = '/project/B';
      
      const result = wrapper.formatResponse(cleanOutput, contextInfo, workdir);
      
      expect(result).toContain('안녕하세요');
      expect(result).toContain('[워크스페이스: /project/B]');
      expect(result).not.toContain('[컨텍스트:');
    });
    
    test('should handle empty output', () => {
      const wrapper = new KiroWrapper();
      const cleanOutput = '';
      const contextInfo = { used: 100, total: 1000, percentage: 10 };
      const workdir = '/test';
      
      const result = wrapper.formatResponse(cleanOutput, contextInfo, workdir);
      
      expect(result).toContain('[워크스페이스: /test]');
      expect(result).toContain('[컨텍스트: 10% (100/1000 토큰)]');
    });
  });
  
  describe('clearSession', () => {
    test('should delete session files when they exist', async () => {
      const wrapper = new KiroWrapper();
      const testWorkdir = '/tmp/test-kiro-session';
      const sessionPath = path.join(testWorkdir, '.kiro', 'sessions');
      
      // Setup: Create test session files
      fs.mkdirSync(sessionPath, { recursive: true });
      fs.writeFileSync(path.join(sessionPath, 'session1.json'), '{}');
      fs.writeFileSync(path.join(sessionPath, 'session2.json'), '{}');
      
      await wrapper.clearSession(testWorkdir);
      
      // Verify files are deleted
      const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
      expect(files.length).toBe(0);
      
      // Cleanup
      fs.rmSync(testWorkdir, { recursive: true, force: true });
    });
    
    test('should not throw error when session path does not exist', async () => {
      const wrapper = new KiroWrapper();
      const testWorkdir = '/tmp/nonexistent-kiro-session';
      
      await expect(wrapper.clearSession(testWorkdir)).resolves.not.toThrow();
    });
    
    test('should handle empty session directory', async () => {
      const wrapper = new KiroWrapper();
      const testWorkdir = '/tmp/empty-kiro-session';
      const sessionPath = path.join(testWorkdir, '.kiro', 'sessions');
      
      // Setup: Create empty session directory
      fs.mkdirSync(sessionPath, { recursive: true });
      
      await wrapper.clearSession(testWorkdir);
      
      // Verify no error
      expect(fs.existsSync(sessionPath)).toBe(true);
      
      // Cleanup
      fs.rmSync(testWorkdir, { recursive: true, force: true });
    });
  });
  
  describe('chat with session state management', () => {
    test('should not include --resume flag for new chat session', async () => {
      const mockDb = {
        getChatSession: jest.fn().mockReturnValue(null),
        activateChatSession: jest.fn()
      };
      
      const mockWorkspaceService = {
        getWorkdirForKiro: jest.fn().mockReturnValue('/test/workspace')
      };
      
      const wrapper = new KiroWrapper(mockWorkspaceService, mockDb);
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'test response',
        stderr: ''
      });
      
      await wrapper.chat('test message', {}, null, 'chat123');
      
      expect(mockDb.getChatSession).toHaveBeenCalledWith('chat123');
      expect(wrapper.executeCommandWithStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.not.stringContaining('--resume')
        })
      );
      expect(mockDb.activateChatSession).toHaveBeenCalledWith('chat123', '/test/workspace');
    });
    
    test('should include --resume flag for active chat session', async () => {
      const mockDb = {
        getChatSession: jest.fn().mockReturnValue({
          chat_id: 'chat123',
          workspace_path: '/test/workspace',
          session_active: 1
        }),
        activateChatSession: jest.fn()
      };
      
      const mockWorkspaceService = {
        getWorkdirForKiro: jest.fn().mockReturnValue('/test/workspace')
      };
      
      const wrapper = new KiroWrapper(mockWorkspaceService, mockDb);
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'test response',
        stderr: ''
      });
      
      await wrapper.chat('test message', {}, null, 'chat123');
      
      expect(mockDb.getChatSession).toHaveBeenCalledWith('chat123');
      expect(wrapper.executeCommandWithStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringContaining('--resume')
        })
      );
    });
    
    test('should not include --resume flag after bye command', async () => {
      const mockDb = {
        getChatSession: jest.fn().mockReturnValue({
          chat_id: 'chat123',
          workspace_path: '/test/workspace',
          session_active: 0
        }),
        activateChatSession: jest.fn()
      };
      
      const mockWorkspaceService = {
        getWorkdirForKiro: jest.fn().mockReturnValue('/test/workspace')
      };
      
      const wrapper = new KiroWrapper(mockWorkspaceService, mockDb);
      wrapper.executeCommandWithStreaming = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'test response',
        stderr: ''
      });
      
      await wrapper.chat('test message', {}, null, 'chat123');
      
      expect(wrapper.executeCommandWithStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.not.stringContaining('--resume')
        })
      );
    });
    
    test('should clear database session when clearing session', async () => {
      const mockDb = {
        clearChatSession: jest.fn()
      };
      
      const wrapper = new KiroWrapper(null, mockDb);
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      await wrapper.clearSession('/test/workspace', 'chat123');
      
      expect(mockDb.clearChatSession).toHaveBeenCalledWith('chat123');
    });
  });
});
