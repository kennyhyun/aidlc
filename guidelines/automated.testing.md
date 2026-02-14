# Test automation

Gitlab pipeline runner triggers pipeline test from the sourcefile changes

mostly integration tests using docker

some of those are unit test with mocking

## Writing test cases

### General principles

test code should be as short as possible and also readable because it tells how the target should behave.
different form of software requirements.

please avoid repeat (DRY)

### Seeding test data

because we are using actual db instance running in a docker container, required data should be seeded.
this could be challenging but it's recommended to use packages/model/seeders helpers to seed

examples would be in

- backend/supplier-stack-services/output-image-processing/test/integration/seed/fixtures.js
- backend/supplier-stack-services/gateway-integration/test/integration/controllers/ow-integration.spec.js

seeders could be added for any missing models, following the existing helpers

### Database migration

if you have created a migration, it should be run and update the `latest_schema.sql` which is used to initiate the test db

```bash
yarn --cwd backend/supplier-stack-services/migration-knex test:docker
```

will update `latest_schema.sql`

## Running tests locally

Most of our backend tests are supposed to be running in the docker container.

Check package.json first to see if there's a `test:docker` script available.

### Prerequisites

#### Shared packages

if it has shared packages changed, it should be rebuilt and the yarnCache volume should be cleared

try this just in case

```
docker system prune --volumes
yarn dc:test down -v
```

### Running focused backend tests using Jest

Most backend services use Jest for testing. Check if the service has jest for the "test" script in package.json.

1. check if the test container is running
2. if `docker ps |grep -o "gateway-output-test-[^ ]\+"` has some output, gateway-output test runner is running
   1. use the runner and trigger test like
   `docker exec $(docker ps |grep -o "gateway-output-test-[^ ]\+") bash -c "yarn test test/integration/failing-test.spec.js | pino-pretty"  > .files/test-result.log 2>&1`
3. or, you can run the test runner like
   1. `yarn dc:test run -d test bash -c "yarn && tail -f /dev/null"`
   2. and wait for `docker logs --tail 10 $(docker ps |grep -o "gateway-output-test-[^ ]\+")` has `Done` for installing node packages
   3. then you can use the container using `docker exec` like the previous step

it's better to save the result logs in a file, and use tail or grep.

for example, use temp file in `.files` directory

** The test container can be used for mocha test too

#### Running focused test on specific case

**Using `.only()` modifier:**

- mocha: runs only those cases
- Jest: runs all test files but skips cases without `.only()` in each file

⚠️ Don't commit `.only()` - it will skip tests in CI

**Using Jest `-t` option (recommended):**

```bash
# With file path (faster - loads only specified file)
yarn test path/to/specific.spec.js -t "should handle error cases"

# Without file path (slower - scans all test files)
yarn test -t "should handle error cases"

# In docker container
docker exec $(docker ps |grep -o "gateway-output-test-[^ ]\+") \
  bash -c "yarn test test/integration/user.spec.js -t 'error' | pino-pretty" > .files/test-result.log 2>&1
```

## Investigating Gitlab pipeline result

For the gitlab token info, project ids, follow the guide at aidlc/guidelines/gitlab.md

you can find the backend gitlab test scripts on /home/kenny/Projects/imagine-online/gitlab-ci-includes/testing/backend/supplier-stack-services

so you can fetch the result of each test and help how to fix or discuss

because the log is massive, download it in the `.files` directory, for example, docs/tickets/task/PREF-14976_kioskdecide-the-kiosk-rendering-and-launch-the-rendering-app-minimised/.files
and then use grep command to check the result
