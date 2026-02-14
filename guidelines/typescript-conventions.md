# TypeScript Conventions

## Typing Philosophy

Prefer implicit typing (letting TypeScript infer types) as much as possible to keep code concise and similar to JavaScript.

## Avoid Explicit `any`

Use default parameter values and destructuring to enable type inference instead.

### Example:

```typescript
// ✅ Good - TypeScript infers types based on default values
async (id = '', { isActive = false, name = '' } = {}) => {
  // function body
}
```

```typescript
// ❌ Bad - Explicit type annotations
async (id: string, { isActive, name }: { isActive?: boolean; name?: string }) => {
  // function body
}
```

## When to Use Explicit Types

Use explicit type definitions in the following cases:

- For exported functions in shared packages under the `@ourpackage/` namespace
- For complex object structures and function parameters where the structure isn't immediately obvious
- When type inference might be unclear or insufficient, especially in code that will be used by other developers

## Best Practices

- Use interfaces or type aliases for complex object structures that are reused across the codebase
- Use default parameters instead of optional parameters with separate type definitions
- Use assert for the required parameter explicitly if runtime check was necessary
- When destructuring objects in function parameters, prefer using default values to enable type inference
- Use TypeScript's powerful features (like `as const`, utility types, enums) strategically only where they add value

## Error Typing

Latest Node.js has error as `unknown` recently, which raises typing error on `error.message`.

- Using type guard like `instanceof Error` could miss `AxiosError`
- Using `any` is recommended for catching error
- Optional chaining is necessary for avoiding runtime error

```typescript
// ✅ Good
try {
  await doSomething();
} catch (error: any) {
  logger.error(error?.message);
}
```
