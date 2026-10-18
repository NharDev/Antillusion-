# Vue 3, Svelte 5 and other front-end frameworks
tags: vue nuxt pinia svelte sveltekit solid astro angular composition api runes component فيو سفيلت انجولار

Vue 3 (Composition API, `<script setup lang="ts">`): `const count = ref(0)` (use `.value` in script), `reactive({…})` for objects, `computed(() => …)`, `watch(source, cb)` / `watchEffect`, `defineProps<{ title: string }>()`, `defineEmits<{ save: [id: string] }>()`, `v-model` (+ `defineModel()`), `v-for` with `:key`, `v-if`/`v-show`, slots, `provide`/`inject`, composables (`useX()` functions returning refs). Router: vue-router (`<RouterView>`, `useRoute`, `useRouter`). Store: Pinia (`defineStore("cart", () => { const items = ref([]); … return { items } })`). Nuxt adds file routing (`pages/`), auto-imports, `useFetch`/`useAsyncData`, server routes in `server/api/*.ts`.

Svelte 5 (runes): `let count = $state(0)`, `const double = $derived(count * 2)`, `$effect(() => { … })`, props `let { title, onsave } = $props()`, bindable `$bindable()`, events as plain attributes (`onclick={…}`), `{#if}`, `{#each items as item (item.id)}`, snippets instead of slots (`{#snippet row(x)}…{/snippet}` + `{@render row(x)}`), scoped `<style>`. SvelteKit: `src/routes/+page.svelte`, `+page.server.ts` (`load`, form `actions`), `+layout.svelte`, `+server.ts` endpoints; adapters for deployment.

SolidJS: fine-grained signals (`const [n, setN] = createSignal(0)` — call `n()`), `createEffect`, `createMemo`, `<For>`, `<Show>`; components run once, so never destructure props.

Astro: content-first sites; `.astro` components render to HTML at build with zero JS by default; islands hydrate interactive components (`<Counter client:visible />`) from React/Vue/Svelte; content collections for Markdown/MDX with typed frontmatter.

Angular (v17+): standalone components, signals (`signal`, `computed`, `effect`), new control flow (`@if`, `@for (x of xs; track x.id)`), DI via `inject()`, HttpClient, router with lazy routes, `ng new app --defaults`, `ng serve` (port 4200).

HTMX / Alpine: server-rendered HTML with sprinkles — `hx-get`, `hx-post`, `hx-target`, `hx-swap` return HTML fragments; Alpine `x-data`, `x-on`, `x-show` for local state. Ideal with Django, Flask, Laravel, Go templates.

Whatever the framework: check the installed major version in package.json before writing syntax (Vue 2 vs 3, Svelte 4 vs 5, Next pages vs app router differ a lot), and follow the conventions already in the repo.
