const ConfigLoader = require('../../src/shared/config-loader');

describe('ID Resolution', () => {
  let loader;
  
  beforeEach(() => {
    loader = new ConfigLoader();
  });
  
  test('should resolve task reference by name', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend' },
      { id: 'run-tests-7b4e', name: 'Run Tests', needs: ['Build Backend'] }
    ];
    
    const resolved = loader.resolveReferences(tasks);
    
    expect(resolved[1].needs[0]).toBe('build-backend-a3f2');
  });
  
  test('should keep full ID references as-is', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend' },
      { id: 'run-tests-7b4e', name: 'Run Tests', needs: ['build-backend-a3f2'] }
    ];
    
    const resolved = loader.resolveReferences(tasks);
    
    expect(resolved[1].needs[0]).toBe('build-backend-a3f2');
  });
  
  test('should throw error on ambiguous reference', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend Services' },
      { id: 'build-backend-f9e1', name: 'Build Backend API' },
      { id: 'test-7b4e', name: 'Test', needs: ['Build Backend'] }
    ];
    
    expect(() => loader.resolveReferences(tasks)).toThrow('Ambiguous reference');
  });
  
  test('should throw error on non-existent reference', () => {
    const tasks = [
      { id: 'build-backend-a3f2', name: 'Build Backend' },
      { id: 'test-7b4e', name: 'Test', needs: ['Non Existent Task'] }
    ];
    
    expect(() => loader.resolveReferences(tasks)).toThrow('Task not found');
  });
});
