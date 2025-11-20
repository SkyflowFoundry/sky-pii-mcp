# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit testing.

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

```
tests/
├── unit/
│   ├── middleware/       # Tests for Express middleware
│   ├── tools/           # Tests for MCP tool handlers
│   ├── context/         # Tests for AsyncLocalStorage context
│   └── mappings/        # Tests for entity/type mappings
└── README.md
```

## Writing Tests

### Basic Test Example

```typescript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something", () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });
});
```

### Mocking Example

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Function with dependency", () => {
  it("should call external API", () => {
    const mockFn = vi.fn();
    mockFn.mockReturnValue("mocked value");

    expect(mockFn()).toBe("mocked value");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```

## Configuration

- **vitest.config.ts** - Vitest test runner configuration
- **tsconfig.json** - TypeScript compiler configuration

## Coverage

Coverage reports are generated in the `coverage/` directory (git-ignored).

- `coverage/index.html` - Visual HTML report
- `coverage/coverage-final.json` - JSON data

## Next Steps

As you write tests, consider:

1. **Refactoring for testability** - Extract pure functions from server.ts
2. **Mocking Skyflow SDK** - Use `vi.mock()` to mock external dependencies
3. **Testing error paths** - Test both success and failure scenarios
4. **Async testing** - Use `async/await` for testing async code
