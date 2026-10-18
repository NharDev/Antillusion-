# React + TypeScript (Vite or Next.js)
tags: react vite typescript hooks components state tailwind jsx tsx frontend spa رياكت تطبيق ويب مكونات واجهه

Layout: `src/main.tsx` → `App.tsx`; `src/components/` (pure UI), `src/features/<name>/` (component + hooks + api for one feature), `src/lib/` (helpers, api client), `src/hooks/`. Co-locate tests (`X.test.tsx`).

Rules of thumb:
- State lives as low as possible; lift only when shared. Derive, don't duplicate: compute from props/state during render instead of syncing with `useEffect`.
- `useEffect` is for synchronising with the outside world (subscriptions, timers, DOM, network without a library). Always clean up; never fetch-in-effect without cancellation — prefer TanStack Query (`useQuery({ queryKey, queryFn })`) for server state.
- Lists need stable `key`s (ids, not indexes). Event handlers are named `handleX`; props callbacks `onX`.
- Global client state: Zustand store (`create((set) => ({ … }))`) with selectors; URL is state too (search params for filters/pagination).
- Forms: react-hook-form + zod resolver; controlled inputs only when you need per-keystroke logic.
- Performance: measure first; `useMemo`/`useCallback` only for expensive work or referential stability of deps; virtualise long lists; `lazy()` + `<Suspense>` for route-level code splitting.
- Types: `type Props = { … }`; avoid `any`; discriminated unions for async state (`{status:'loading'} | {status:'error', error} | {status:'success', data}`); `satisfies` for config objects.
- Accessibility: buttons are `<button>`, links are `<a>`; label every input; manage focus on route/modal change.

Next.js (App Router): files in `app/` — `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `route.ts` (API). Components are Server Components by default (async, fetch directly, no hooks); add `"use client"` only for interactivity. Mutations via Server Actions (`"use server"`) + `revalidatePath`. Env: only `NEXT_PUBLIC_*` reaches the browser. `params`/`searchParams` are async in recent versions — `await` them.

Testing: Vitest + @testing-library/react (`render`, `screen.getByRole`, `userEvent`); test behaviour, not implementation. E2E with Playwright.
