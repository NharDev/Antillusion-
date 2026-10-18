# TypeScript essentials
tags: typescript ts types generics tsconfig interface zod strict type error تايب سكربت انواع

tsconfig for apps (bundler handles emit): `"strict": true, "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "noUncheckedIndexedAccess": true, "skipLibCheck": true, "verbatimModuleSyntax": true, "noEmit": true`. For Node libraries: `"module": "NodeNext"` and write relative imports with `.js` extensions. Run TS directly with `tsx file.ts`; type-check with `tsc --noEmit`.

Modelling:
- Prefer `type` unions and discriminated unions over class hierarchies: `type Result<T> = { ok: true; value: T } | { ok: false; error: string }`; exhaustiveness via `default: { const _never: never = x; }`.
- `unknown` at boundaries, then narrow (type guards, `in`, `instanceof`) or parse with zod: `const User = z.object({ id: z.string(), age: z.number().int().optional() }); type User = z.infer<typeof User>;` — one source of truth for runtime validation and static type.
- Utility types: `Partial`, `Required`, `Pick`, `Omit`, `Record<K, V>`, `ReturnType<typeof f>`, `Awaited<T>`, `Parameters<F>`, `NonNullable<T>`.
- `as const` for literal tuples/objects; `satisfies` to check a value against a type without widening it.
- Generics with constraints: `function byId<T extends { id: string }>(xs: T[], id: string): T | undefined`.
- Avoid `any`, non-null `!`, and `as` casts except at proven boundaries; avoid enums (use union of string literals); avoid `namespace`.
- Async: `Promise<T>` return types explicit on exported functions; errors are `unknown` in `catch (e)` — narrow with `e instanceof Error`.

Fixing type errors: read the last line of the message first (the real mismatch); check for `undefined` from optional fields or index access; widen the declaration rather than casting the use; for third-party types install `@types/<pkg>` or check the package ships its own.
