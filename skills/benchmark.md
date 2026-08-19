---
name: benchmark
description: Use this skill to measure performance baselines, detect regressions before and after PRs, and compare alternative technology stacks.
origin: ECC
metadata:
  mcpmarket-version: 1.0.0
---

# Benchmark — Performance Baselines and Regression Detection

## Use Cases

- Measure performance impact before and after a PR
- Establish a performance baseline for a project
- Investigate user reports that the application "feels slower"
- Ensure performance targets are met before release
- Compare performance across different technology stacks

> **Platform note:** The original skill was written around ECC-specific
> browser MCP and `/benchmark` slash-commands and `.ecc/benchmarks/` storage.
> Those are illustrative. In Zaro the equivalents are: browser tools for page
> metrics, `http_fetch` for API benchmarks, and workspace files (e.g.
> `/benchmarks/*.json`) rather than `.ecc/`. The measurement methodology below
> is kept intact.

## How It Works

### Mode 1: Page Performance

Use browser automation to measure real-browser metrics:

1. Navigate to each target URL.
2. Measure Core Web Vitals and related metrics:
   - LCP (Largest Contentful Paint) — target < 2.5s
   - CLS (Cumulative Layout Shift) — target < 0.1
   - INP (Interaction to Next Paint) — target < 200ms
   - FCP (First Contentful Paint) — target < 1.8s
   - TTFB (Time to First Byte) — target < 800ms
3. Measure resource sizes:
   - Total page weight (target < 1MB)
   - JS bundle size (target < 200KB gzipped)
   - CSS size
   - Image weight
   - Third-party script weight
4. Count the number of network requests.
5. Check for render-blocking resources.

### Mode 2: API Performance

Benchmark API endpoints:

1. Make 100 requests to each endpoint (via `http_fetch`).
2. Measure: p50, p95, and p99 latency.
3. Track: response size and status code.
4. Load test: 10 concurrent requests.
5. Compare results against SLA targets.

### Mode 3: Build Performance

Measure development feedback-loop efficiency:

1. Cold build time
2. Hot reload (HMR) time
3. Test suite execution time
4. TypeScript check time
5. Lint time
6. Docker build time

### Mode 4: Before/After Comparison

Run benchmarks before and after a change to measure its impact. In Zaro, this is done by saving baseline JSON and diffing:

```text
benchmark baseline    # save current metrics to /benchmarks/baseline-<date>.json
# ... make changes ...
benchmark compare     # compare against the baseline
```

Example output:

```text
| Metric | Before | After | Delta | Verdict |
|--------|--------|-------|-------|---------|
| LCP | 1.2s | 1.4s | +200ms | WARNING |
| Bundle | 180KB | 175KB | -5KB | ✓ BETTER |
| Build | 12s | 14s | +2s | WARNING |
```

## Output

Store baseline data as JSON in the workspace (e.g. `/benchmarks/`). Track the files with Git so the team can share and review performance baselines.

## Integration

- **CI:** run the compare step on every PR (e.g. a Zaro `schedule_task` triggered by file changes on the benchmark-critical paths, or wired into the repo's CI workflow).
- **Post-deployment:** pair with canary/monitoring.
- **Pre-release:** pair with a browser-QA checklist.

## Targets Reference

| Metric | Good | Warning |
|---|---|---|
| LCP | < 2.5s | > 4.0s |
| CLS | < 0.1 | > 0.25 |
| INP | < 200ms | > 500ms |
| FCP | < 1.8s | > 3.0s |
| TTFB | < 800ms | > 1.8s |
| Page weight | < 1MB | > 3MB |
| JS bundle (gzip) | < 200KB | > 500KB |
