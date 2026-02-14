# Directory Structure Instructions

## Monorepo Structure

Use monorepo to manage multiple modules in a single git repository.

- Repository layout:
  - `package/` - Shared package (util, middleware, constant, etc.)
  - `backend/` - Backend services
  - `app/` - Client applications
- Module references:
  - Within same package: Use relative paths
    - Example: `import { helper } from '../shared/util'`
  - Cross-package: Use package name
    - Example: `import { TYPES } from '@ourpackage/constant'`

## Module Directory Structure

- Source: `src/` (recommended), `lambda/` (legacy)
  - Place shared utilities in `src/shared/`
  - Place feature-specific code in appropriate subdirectories
    - e.g. `service/`, `handler/`, `route/`, `model/`, `component/`
- Test: `test/`
- Build: `dist/`

## File Naming

- Use kebab-case: like `user-service.js`, `auth-middleware.js`
- Use descriptive names that reflect functionality
- Test files: `*.spec.js`
