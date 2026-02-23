const KiroWrapper = require('../../src/services/kiro-wrapper');
const stripAnsi = require('strip-ansi');

describe('KiroWrapper', () => {
  let wrapper;
  
  beforeEach(() => {
    wrapper = new KiroWrapper();
  });
  
  describe('stripAnsi dependency', () => {
    test('should have stripAnsi as a function', () => {
      expect(typeof stripAnsi).toBe('function');
    });
    
    test('should strip ANSI codes correctly', () => {
      const input = '\x1b[31mRed Text\x1b[0m';
      const output = stripAnsi(input);
      expect(output).toBe('Red Text');
    });
    
    test('should handle text without ANSI codes', () => {
      const input = 'Plain Text';
      const output = stripAnsi(input);
      expect(output).toBe('Plain Text');
    });
    
    test('should handle empty string', () => {
      const output = stripAnsi('');
      expect(output).toBe('');
    });
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
    
    test('should handle command with ANSI codes', async () => {
      // Use printf to output ANSI codes
      const result = await wrapper.executeCommand({
        command: 'printf "\\033[31mRed\\033[0m"',
        workdir: process.cwd(),
        timeout: 5
      });
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('\x1b[31m');
    }, 10000);
  });
  
  describe('chat', () => {
    test('should strip ANSI codes from kiro-cli output', async () => {
      // Mock executeCommand to return output with ANSI codes
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: '\x1b[32mSuccess: Task completed\x1b[0m\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('test message');
      
      expect(result).toBe('Success: Task completed');
      expect(result).not.toContain('\x1b[');
    });
    
    test('should handle output without ANSI codes', async () => {
      wrapper.executeCommand = jest.fn().mockResolvedValue({
        code: 0,
        stdout: 'Plain output\n',
        stderr: ''
      });
      
      const result = await wrapper.chat('test message');
      
      expect(result).toBe('Plain output');
    });
  });
});
