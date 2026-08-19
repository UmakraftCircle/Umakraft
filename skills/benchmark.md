---
name: benchmark
description: Use this skill to measure performance baselines, detect regressions before and after PRs, and compare alternative technology stacks.
origin: ECC
metadata:
  mcpmarket-version: 1.0.0
---

# Benchmark — Performance Baselines and Regression Detection

## Use Cases

- Measure performance impact before/after a PR
- Establish a baseline
- Investigate "feels slower" reports
- Ensure targets met before release
- Compare technology stacks

> **Platform note:** The original skill referenced ECC browser MCP and `/benchmark` slash-commands. In Zaro: browser tools for page metrics, `http_fetch` for API benchmarks, workspace files (e.g. `/benchmarks/*.json`) for storage. Methodology below is kept intact.

## Mode 1: Page Performance

1. Navigate to each URL.
2. Measure Web Vitals: LCP (<2.5s), CLS (<0.1), INP (<200ms), FCP (<1.8s), TTFB (<800ms).
3. Measure resource sizes: page weight (<1MB), JS bundle (<200KB gzip), CSS, images, third-party scripts.
4. Count network requests.
5. Check render-blocking resources.

## Mode 2: API Performance

1. Make 100 requests per endpoint (`http_fetch`).
2. Measure p50/p95/p99 latency, response size, status.
3. Load test: 10 concurrent requests.
4. Compare against SLA targets.

## Mode 3: Build Performance

Cold build, HMR, test suite time, type-check, lint, Docker build.

## Mode 4: Before/After Comparison

```text
benchmark baseline    # save metrics to /benchmarks/baseline-<date>.json
# ... change ...
benchmark compare     # diff against baseline
```

Example output:
```text
| Metric | Before | After | Delta | Verdict |
| LCP | 1.2s | 1.4s | +200ms | WARNING |
| Bundle | 180KB | 175KB | -5KB | ✓ BETTER |
```

## Output

Store baseline JSON in the workspace (e.g. `/benchmarks/`), tracked by Git.

## Integration

- **CI:** run compare on every PR (e.g. a Zaro `schedule_task` triggered by file changes on benchmark-critical paths).
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
