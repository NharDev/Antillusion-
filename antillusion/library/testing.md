# Testing and verification
tags: test testing unit integration e2e vitest jest pytest playwright tdd mock coverage ci اختبار اختبارات فحص

Pyramid: many fast unit tests for pure logic, fewer integration tests through real boundaries (HTTP handler + real test database), a handful of end-to-end flows for what must never break. Test behaviour and contracts, not private implementation.

Good test: Arrange–Act–Assert, one reason to fail, descriptive name ("returns 404 when the todo belongs to another user"), independent of order and time (inject the clock, seed randomness), no network (mock at the boundary: msw / respx), cleans up after itself (temp dirs, transactions rolled back).

JS — Vitest: `import { describe, it, expect, vi } from "vitest"`; `vi.fn()`, `vi.mock("./mod")`, `vi.useFakeTimers()`; run once with `npx vitest run` (plain `vitest` watches forever — never from run_command). DOM tests: `environment: "jsdom"` + Testing Library (`screen.getByRole("button", { name: /save/i })`, `await user.click(…)`).
Node built-in: `node --test`, `import test from "node:test"; import assert from "node:assert/strict"`.
Python — pytest: fixtures, `parametrize`, `tmp_path`, `monkeypatch`, `pytest -q -x --lf`.
E2E — Playwright: `npx playwright install chromium`; `await page.goto(url); await page.getByRole("button",{name:"Add"}).click(); await expect(page.getByText("Done")).toBeVisible();` Use role/label/text locators; auto-waiting — no sleeps.
Rust `cargo test`, Go `go test ./...`, .NET `dotnet test`.

When fixing a bug: first write the failing test that reproduces it, then fix, then keep the test. When adding a feature: cover the happy path, the main edge cases (empty, max, invalid, unauthorised) and one failure of each dependency.

In this app: after UI work, preview_read is your smoke test — it returns console errors and can run JS in the page (click a button, read the resulting DOM) — use it before declaring success.
