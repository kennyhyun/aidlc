const ConfigLoader = require('../../src/shared/config-loader');
const { promises: fs } = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('YAML Auto-correction', () => {
  let loader;
  const testYamlPath = path.join(__dirname, '../fixtures/tasks/auto-correct.yaml');
  
  beforeEach(() => {
    loader = new ConfigLoader();
  });
  
  afterEach(async () => {
    await fs.unlink(testYamlPath).catch(() => {});
  });
  
  test('should add IDs to tasks without them', async () => {
    const content = `tasks:
  - name: "Build Backend"
    command: "kiro chat 'Build backend'"
  - name: "Run Tests"
    command: "kiro chat 'Run tests'"
`;
    await fs.writeFile(testYamlPath, content, 'utf8');
    
    await loader.autoCorrectYaml(testYamlPath);
    
    const corrected = await fs.readFile(testYamlPath, 'utf8');
    const data = yaml.load(corrected);
    
    expect(data.tasks[0].id).toMatch(/^build-backend-[0-9a-f]{4}$/);
    expect(data.tasks[1].id).toMatch(/^run-tests-[0-9a-f]{4}$/);
  });
  
  test('should preserve existing IDs', async () => {
    const content = `tasks:
  - id: build-backend-a3f2
    name: "Build Backend"
    command: "kiro chat 'Build backend'"
`;
    await fs.writeFile(testYamlPath, content, 'utf8');
    
    await loader.autoCorrectYaml(testYamlPath);
    
    const corrected = await fs.readFile(testYamlPath, 'utf8');
    const data = yaml.load(corrected);
    
    expect(data.tasks[0].id).toBe('build-backend-a3f2');
  });
});
