# Planning & delivering software projects: specs, scoping, milestones, quality gates
tags: plan planning spec requirements scope mvp roadmap milestones architecture user stories acceptance criteria estimation risk definition of done prd project management repo structure خطه تخطيط مواصفات متطلبات نطاق مراحل معماريه قصص مستخدم معايير قبول تقدير مخاطر ادارة مشروع

## From idea to spec (what the planner outputs)
1. **Problem & users**: who is stuck, doing what, why it matters. One sentence.
2. **Success metric**: how we'll know it works (e.g., "create an invoice in < 30 s", "p95 API < 300 ms").
3. **Scope (MoSCoW)**: Must (MVP) · Should · Could · Won't (now). MVP = the smallest thing that delivers the core value end-to-end.
4. **User flows**: numbered steps for the 3–5 main journeys, including the failure path.
5. **Data model**: entities, key fields, relations, ownership, retention.
6. **Architecture**: components and boundaries, stack with a reason, external services, auth model, deployment target. Record decisions as short ADRs (context → decision → consequences).
7. **Risks & unknowns**: technical (new API, performance), product (unclear need), delivery (dependencies). Each with a mitigation or a spike.
8. **Milestones**: each leaves a *runnable* product and has an acceptance test.

## Acceptance criteria
`Given <state> When <action> Then <observable result>` or a checklist of verifiable statements. A milestone is done only when every criterion has been run (not "should work").

## Milestone ordering
M0 repo + tooling + hello world deployed/running · M1 walking skeleton (UI → API → DB for one trivial flow) · M2 the core value flow · M3 supporting features (auth, settings, errors) · M4 hardening (validation, tests, a11y, performance) · M5 polish & docs · M6 release. Vertical slices over horizontal layers; riskiest unknown first.

## Estimating
Size in T-shirts or hours with ranges (best/likely/worst); multiply by 1.5–2 for integration/unknowns; re-plan at each milestone; cut scope, not quality, to hit dates.

## Definition of done
Runs locally from a clean checkout with documented commands · passes lint/typecheck/tests · errors handled and visible · no secrets in code · accessible basics (labels, contrast, keyboard) · docs updated · demo-able.

## Repo & workflow
```
README.md  .env.example  package.json|pyproject.toml  src/  tests/  docs/  scripts/  .github/workflows/ci.yml
```
Small commits with imperative messages; one concern per change; branch per feature; CI runs lint + test + build; conventional folders (`src/features/<name>` for feature code, shared UI/lib separate); config via env; scripts: `dev`, `build`, `test`, `lint`, `seed`.

## Testing pyramid
Many unit tests for pure logic · some integration tests for API/DB · few end-to-end tests for critical journeys (login, checkout, core flow). Test behaviour not implementation; seed deterministic data; run tests in CI.

## Non-functional checklist
Security (authz on every endpoint, input validation, rate limits, secrets, dependency audit) · Performance (budget, indexes, pagination, caching) · Reliability (timeouts, retries with backoff, idempotency, graceful errors) · Observability (structured logs, health endpoint, error tracking) · Privacy (minimise data, delete/export) · i18n/RTL (Arabic: logical CSS properties, localized dates/numbers) · Accessibility.

## Spec template (copy)
```
# <Project>
Problem · Users · Success metric
Scope: Must / Should / Could / Won't
Flows: 1… 2… 3…
Data model: Entity(field: type, …)
Architecture: stack + reasons; diagram in words
Milestones: M1 <deliverable> — accept: <Given/When/Then>
Risks: <risk> → <mitigation>
Open questions: ≤ 3
```

## Turning a vague request into a brief (prompt expansion)
Fill the blanks with sensible defaults and *state them*: audience, platform, visual style (3 adjectives), core features (3–7), data/storage, auth needs, languages (RTL?), performance/offline, deliverables (files, run command), definition of done. Ask only the question whose answer would change the architecture.
