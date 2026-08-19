---
name: error-handling-patterns
description: Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation to build resilient applications. Use when implementing error handling, designing APIs, or improving application reliability.
metadata:
  mcpmarket-version: 1.0.0
---

# Error Handling Patterns

Build resilient applications with robust error handling strategies that gracefully handle failures and provide excellent debugging experiences.

> **Note:** This skill is platform- and language-agnostic. It applies equally whether the code is written by a human or an AI coding agent (including Zaro). The patterns below are universal engineering guidance, not tied to any specific editor, CLI, or agent runtime.

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

**Recoverable Errors:**
- Network timeouts
- Missing files
- Invalid user input
- API rate limits

**Unrecoverable Errors:**
- Out of memory
- Stack overflow
- Programming bugs (null pointer, etc.)

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
    """Raised when validation fails."""
    pass

class NotFoundError(ApplicationError):
    """Raised when resource not found."""
    pass

class ExternalServiceError(ApplicationError):
    """Raised when external service fails."""
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

def retry(
    max_attempts: int = 3,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,)
):
    """Retry decorator with exponential backoff."""
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

function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

function Err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}
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

Use explicit error returns, wrapping with `%w`, and `errors.Is` / `errors.As` for structured inspection.

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

Prevent cascading failures in distributed systems.

A circuit breaker typically has three states:

- **CLOSED** — normal operation
- **OPEN** — requests are rejected while the dependency is failing
- **HALF_OPEN** — limited requests test whether the dependency has recovered

Use failure thresholds, recovery timeouts, and success thresholds to control state transitions.

### Pattern 2: Error Aggregation

Collect multiple validation errors instead of failing on the first error.

```typescript
class ErrorCollector {
    private errors: Error[] = [];

    add(error: Error): void {
        this.errors.push(error);
    }

    hasErrors(): boolean {
        return this.errors.length > 0;
    }

    getErrors(): Error[] {
        return [...this.errors];
    }

    throw(): never {
        if (this.errors.length === 1) throw this.errors[0];
        throw new AggregateError(
            this.errors,
            `${this.errors.length} errors occurred`
        );
    }
}
```

### Pattern 3: Graceful Degradation

Provide fallback functionality when failures occur.

```python
def with_fallback(primary, fallback):
    try:
        return primary()
    except Exception as e:
        logger.error("Primary function failed: %s", e)
        return fallback()
```

## Best Practices

1. **Fail Fast** — Validate input early and fail quickly.
2. **Preserve Context** — Include useful stack traces, metadata, and timestamps.
3. **Meaningful Messages** — Explain what happened and how it can be fixed.
4. **Log Appropriately** — Log unexpected errors without spamming expected failures.
5. **Handle at the Right Level** — Catch errors where they can be meaningfully handled.
6. **Clean Up Resources** — Use `try/finally`, context managers, `defer`, or equivalents.
7. **Don't Swallow Errors** — Log, return, or re-throw intentionally.
8. **Use Type-Safe Errors** — Prefer typed errors where the language supports them.
9. **Retry Selectively** — Retry transient failures, not permanent failures.
10. **Use Backoff and Jitter** — Avoid synchronized retry storms.
11. **Protect Sensitive Data** — Never expose secrets or sensitive information in errors/logs.

## Common Pitfalls

- **Catching Too Broadly** — `except Exception` can hide programming bugs.
- **Empty Catch Blocks** — Silently swallowing errors.
- **Duplicate Logging** — Logging and re-throwing at every layer creates noisy logs.
- **Missing Cleanup** — Forgetting to close files, connections, or other resources.
- **Poor Error Messages** — Messages such as `"Error occurred"` lack actionable context.
- **Overusing Error Codes** — Prefer structured errors or typed results where appropriate.
- **Ignoring Async Errors** — Unhandled promise rejections and task failures can become incidents.
- **Retrying Non-Retryable Errors** — Only retry transient failures.
- **Retry Storms** — Use exponential backoff and jitter.
- **Leaking Sensitive Data** — Keep credentials, tokens, and private data out of errors and logs.

## Resources

- `references/exception-hierarchy-design.md` — Designing error class hierarchies
- `references/error-recovery-strategies.md` — Recovery patterns for different scenarios
- `references/async-error-handling.md` — Handling errors in concurrent code
- `assets/error-handling-checklist.md` — Review checklist for error handling
- `assets/error-message-guide.md` — Writing helpful error messages
- `scripts/error-analyzer.py` — Analyze error patterns in logs
