# Code Conventions

## Prohibited Packages

- await-to-js

## fs Module

**NEVER use synchronous APIs in Node.js applications.**
Synchronous operations block the event loop and severely impact performance. use fs.promises instead

## Basic Style

- Standard ES6+ syntax is preferred.
- if it can be rewritten in simple ES6+ syntax, please do not use npm packages.
- destructuring is preferred over using the dot operator.
- Use async/await for asynchronous operations.
- `.then().catch()` is acceptable when it makes code more concise or avoids using `let`:
  ```javascript
  const result = fetchData().catch(() => null);
  return API.get(url).then(res => res.data).catch(() => []);
  ```

## Logging and Error Handling

- Use logger from "@ourpackage/utils"
- Logger levels:
  - `logger.info` - Informational messages
  - `logger.debug` - Less important messages
  - `logger.error` - Error messages
- Include context in log messages (e.g., `<context>/<functionName>:: `)
- When writing error messages, provide cause clearly and suggest resolution if possible
- Don't pass error instance directly, use `e.stack` or `e.message` instead
- `console.log` is allowed in test cases and `/client` module

## Loops

- Use `.forEach()`, `.map()`, `.filter()`, `.reduce()` for functional style
- Avoid `for` loop: use `Array(n).fill().forEach()` to prevent `let` scope and control flow bugs
- For sequential async, prefer `reduce` with Promise over `for...of`
- Exception: use `for`/`while` when n ≥ 100 or early return needed

## Variable Names

Use clear naming for global variables and local variable should have a short scope.
A short variable name is only allowed when it's declared and consumed with a few lines.

Variable name from database Models:
- camel case xxxId is number type (because of legacy database schema)
- camel case xxxNo is string type (because of legacy database schema)

## Backend Practices

- Use `handlePromise` in Express routes
- Don't catch exceptions just for logging `error.stack`
- Add try-catch only when adding context or debug info

```javascript
// ✅ Good
router.get('/users', handlePromise(async (req, res) => {
  const users = await getUsers();
  res.json(users);
}));

// ❌ Bad - unnecessary catch
try {
  await doSomething();
} catch (error) {
  console.error(error.stack); // Only logging
  throw error;
}
```
