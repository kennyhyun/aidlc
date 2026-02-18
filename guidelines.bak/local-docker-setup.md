# Local Docker Setup

## Volume Mappings

For local development with Docker, host paths are mounted into containers:

| Host Path | Container Path | Container |
|-----------|----------------|----------|
| `localstack/localservice/` | `localservice/` | localgateway, localoutput |
| `localstack/localservice/package.json` | `package.json` | localgateway |
| `localstack/localoutput/package.json` | `package.json` | localoutput |

Note: All paths relative to `/backend/suppliers-stack-services/`

## Symlinked Files

Service files are automatically symlinked in containers:
- Example: `gateway-output/lambda/services/database/*.ts`
- Available in: localgateway, localoutput containers
