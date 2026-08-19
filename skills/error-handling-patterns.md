---
name: error-handling-patterns
description: Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation to build resilient applications. Use when implementing error handling, designing APIs, or improving application reliability.
metadata:
  mcpmarket-version: 1.0.0
---

# Error Handling Patterns

Build resilient applications with robust error handling strategies that gracefully handle failures and provide excellent debugging experiences.

> **Note:** This skill is platform- and language-agnostic. It applies equally whether the code is written by a human or an AI coding agent (including Zaro).

## When to Use This Skill

- Implementing error handling in new features
- Designing error-resilient APIs
- Debugging production issues
- Improving application reliability
- Creating better error messages for users and developers
- Implementing retry and circuit breaker patterns
- Handling async/concurrent errors
- Building fault-tolerant distributed systems

## Core Concepts

### 1. Error Handling Philosophies

**Exceptions vs Result Types:**
- **Exceptions**: Traditional try-catch, disrupts control flow
- **Result Types**: Explicit success/failure, functional approach
- **Error Codes**: C-style, requires discipline
- **Option/Maybe Types**: For nullable values

**When to Use Each:**
- Exceptions: Unexpected errors, exceptional conditions
- Result Types: Expected errors, validation failures
- Panics/Crashes: Unrecoverable errors, programming bugs

### 2. Error Categories

**Recoverable Errors:** Network timeouts, missing files, invalid user input, API rate limits.

**Unrecoverable Errors:** Out of memory, stack overflow, programming bugs (null pointer, etc.).

## Language-Specific Patterns

### Python Error Handling

**Custom Exception Hierarchy:**
```python
class ApplicationError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ValidationError(ApplicationError):
    pass

class NotFoundError(ApplicationError):
    pass

class ExternalServiceError(ApplicationError):
    def __init__(self, message: str, service: str, **kwargs):
        super().__init__(message, **kwargs)
        self.service = service
```

**Context Managers for Cleanup:**
```python
from contextlib import contextmanager

@contextmanager
def database_transaction(session):
    """Ensure transaction is committed or rolled back."""
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

**Retry with Exponential Backoff:**
```python
import time
from functools import wraps
from typing import TypeVar, Callable

T = TypeVar('T')

def retry(max_attempts=3, backoff_factor=2.0, exceptions=(Exception,)):
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        time.sleep(backoff_factor ** attempt)
                        continue
                    raise
            raise last_exception
        return wrapper
    return decorator
```

### TypeScript/JavaScript Error Handling

**Custom Error Classes:**
```typescript
class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
```

**Result Type Pattern:**
```typescript
type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

function Ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function Err<E>(error: E): Result<never, E> { return { ok: false, error }; }
```

**Async Error Handling:**
```typescript
async function fetchUserOrders(userId: string): Promise<Order[]> {
    try {
        const user = await getUser(userId);
        return await getOrders(user.id);
    } catch (error) {
        if (error instanceof NotFoundError) return [];
        if (error instanceof NetworkError) return retryFetchOrders(userId);
        throw error;
    }
}
```

### Rust Error Handling

Use `Result` for fallible operations, `Option` for nullable values, and the `?` operator for clear error propagation.

```rust
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

### Go Error Handling

Use explicit error returns, wrapping with `%w`, and `errors.Is` / `errors.As`.

```go
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    }
    return user, nil
}
```

## Universal Patterns

### Pattern 1: Circuit Breaker

Three states: **CLOSED** (normal), **OPEN** (reject while failing), **HALF_OPEN** (limited test). Use failure thresholds, recovery timeouts, and success thresholds.

### Pattern 2: Error Aggregation

```typescript
class ErrorCollector {
    private errors: Error[] = [];
    add(error: Error): void { this.errors.push(error); }
    hasErrors(): boolean { return this.errors.length > 0; }
    getErrors(): Error[] { return [...this.errors]; }
    throw(): never {
        if (this.errors.length === 1) throw this.errors[0];
        throw new AggregateError(this.errors, `${this.errors.length} errors occurred`);
    }
}
```

### Pattern 3: Graceful Degradation

```python
def with_fallback(primary, fallback):
    try:
        return primary()
    except Exception as e:
        logger.error("Primary function failed: %s", e)
        return fallback()
```

## Best Practices

1. **Fail Fast** — Validate input early.
2. **Preserve Context** — Include stack traces, metadata, timestamps.
3. **Meaningful Messages** — Explain what happened and how to fix it.
4. **Log Appropriately** — Log unexpected errors without spamming expected failures.
5. **Handle at the Right Level** — Catch where it can be meaningfully handled.
6. **Clean Up Resources** — `try/finally`, context managers, `defer`.
7. **Don't Swallow Errors** — Log, return, or re-throw intentionally.
8. **Use Type-Safe Errors** — Prefer typed errors where supported.
9. **Retry Selectively** — Retry transient failures, not permanent ones.
10. **Use Backoff and Jitter** — Avoid synchronized retry storms.
11. **Protect Sensitive Data** — Never expose secrets in errors/logs.

## Common Pitfalls

- **Catching Too Broadly** — `except Exception` hides bugs.
- **Empty Catch Blocks** — Silently swallowing errors.
- **Duplicate Logging** — Logging + re-throwing at every layer.
- **Missing Cleanup** — Forgetting to close resources.
- **Poor Error Messages** — `"Error occurred"` lacks context.
- **Overusing Error Codes** — Prefer structured/typed errors.
- **Ignoring Async Errors** — Unhandled rejections become incidents.
- **Retrying Non-Retryable Errors** — Only retry transient failures.
- **Retry Storms** — Use exponential backoff and jitter.
- **Leaking Sensitive Data** — Keep secrets out of errors/logs.
