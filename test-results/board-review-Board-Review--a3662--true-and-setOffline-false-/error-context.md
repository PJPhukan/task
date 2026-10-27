# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-review.spec.ts >> Board Review & UI Fixes >> Fix 6: Offline cache with context.setOffline(true) and setOffline(false)
- Location: e2e/board-review.spec.ts:165:7

# Error details

```
Error: page.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('#email-input')

```

```
Error: write EPIPE
```