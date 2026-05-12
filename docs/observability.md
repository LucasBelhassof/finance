# Observability

## Purpose

This document defines the minimum observability baseline for Finly production releases. The goal is to improve diagnosis and rollback confidence without introducing a mandatory external vendor.

## Current Signals

The application already provides:

- structured backend logs through `server/shared/logger.js`
- request correlation via `x-request-id`
- liveness endpoint at `/api/health`
- readiness endpoint at `/api/ready`
- CI validation for lint, tests, build, and Playwright smoke coverage

This baseline is intentionally lightweight. It should remain safe for a personal-finance product.

## Backend Request Logging

Every request should emit one completion log entry with these fields:

- `requestId`
- `method`
- `path`
- `status`
- `durationMs`
- `userId` when the request is authenticated

The request completion log is meant to answer four operational questions quickly:

1. Did the request reach the backend?
2. Which route handled it?
3. Did it succeed or fail?
4. Which authenticated user was affected?

## Frontend Runtime Fallback

The frontend should render a visible fallback UI when an uncaught React render error reaches the application shell. The fallback should:

- avoid a blank screen
- allow page reload
- allow navigation back to a safe route

This fallback is not a substitute for fixing the underlying bug. It only improves failure handling.

## Safe Logging Rules

Do not log:

- passwords
- access tokens
- refresh tokens
- cookies
- secrets
- connection strings
- raw financial payloads
- uploaded statement contents
- raw import files
- raw AI prompts

Prefer route-level metadata and identifiers over full request or response bodies.

When new log statements are added, keep payloads small and structured. If a field is not needed for triage, it should not be logged.

## Optional External Providers

Vendor integrations such as Sentry-compatible error collection may be added later, but they must remain optional and disabled by default unless explicitly configured.

Finly should not require a paid external service to maintain the minimum observability baseline.

## Operational Use

During incident review, check these signals in order:

1. CI result for the release candidate
2. `/api/health`
3. `/api/ready`
4. request completion logs filtered by `requestId`, `path`, or `userId`
5. frontend fallback incidence if a runtime crash occurred
