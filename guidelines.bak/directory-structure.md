# Directory Structure Instructions

## Monorepo Structure

Use monorepo to manage multiple modules in a single git repository.

- Repository layout:
  - `packages/` - Shared packages (utils, model, middlewares, etc.)
  - `backend/` - Backend services
  - `apps/` - Client applications
- Module references:
  - Within same package: Use relative paths
    - Example: `import { helper } from '../shared/utils'`
  - Cross-package: Use package name
    - Example: `import { Model } from '@packages/model'`

## Module Directory Structure

- Source: `src/` (recommended), `lambda/` (legacy)
  - Place shared utilities in `src/shared/`
  - Place feature-specific code in appropriate subdirectories
    - e.g. `services/`, `handlers/`, `routes/`, `models/`, `components/`
- Test: `test/`
- Build: `dist/`

## File Naming

- Use kebab-case: like `user-service.js`, `auth-middleware.js`
- Use descriptive names that reflect functionality
- Test files: `*.spec.js`
