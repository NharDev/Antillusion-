# Architecture and code quality
tags: architecture clean code refactor structure design patterns modules solid naming maintainable monolith هيكله تنظيم كود معماريه

Start simple: a well-structured monolith with clear modules beats premature microservices. Split by feature/domain (`users/`, `billing/`, `catalog/`) rather than by technical layer once the app grows; each module exposes a small public surface and hides its internals.

Layers inside a module: transport (HTTP/CLI/UI) → application/service (use cases, orchestration, transactions) → domain (pure rules, no I/O) → infrastructure (database, external APIs). Dependencies point inwards; I/O is pushed to the edges so the core is trivially testable.

Functions and names: one job per function; names say what and why (`retryWithBackoff`, not `doIt2`); booleans read as questions (`isReady`, `hasAccess`); no hidden side effects; return early instead of nesting; pass data in, get data out; small parameter lists (use an options object).

Errors: fail fast and loudly at boundaries, with context; distinguish expected outcomes (not found, invalid input → typed result or specific exception) from bugs (crash and log); never swallow an exception silently; clean up in `finally`.

State: single source of truth; immutable updates where shared; make illegal states unrepresentable (unions/enums instead of flag soup).

Duplication: three similar occurrences justify an abstraction — not two. The wrong abstraction costs more than repetition.

Comments explain why (constraints, trade-offs, links), not what the next line does. Delete dead code; version control remembers.

Refactoring: only under tests; in small steps that keep everything green; separate commits for behaviour changes and pure moves/renames.

Useful patterns: dependency injection (pass collaborators in), adapter (wrap third-party APIs behind your interface), strategy (table of functions instead of a switch that keeps growing), repository (data access behind methods), pub/sub or event emitter for decoupled reactions, state machine for multi-step flows, queue + worker for slow or retryable jobs, idempotent handlers for anything that can be retried.

Readiness checklist for a change: does it handle empty, huge, invalid and concurrent input; are errors surfaced to the user usefully; is it observable (logs/metrics); is it documented where a newcomer will look (README: what it is, how to run, how to test, how to deploy).
