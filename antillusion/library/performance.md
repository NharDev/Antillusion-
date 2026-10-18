# Performance (web, back-end, algorithms)
tags: performance optimize slow fast speed memory profiling cache lighthouse bundle latency big-o algorithm سرعه اداء بطيء تسريع

Measure before changing anything: browser Performance panel / Lighthouse (LCP < 2.5 s, INP < 200 ms, CLS < 0.1), `console.time`, `node --prof` / `--inspect`, `py-spy` / `cProfile`, `EXPLAIN ANALYZE`, `hyperfine` for CLIs. Fix the biggest measured cost; re-measure.

Front-end: ship less JS (code-split routes, lazy-load heavy widgets, tree-shake, drop unused deps); images in AVIF/WebP at displayed size with `srcset`, lazy below the fold, explicit dimensions; fonts `font-display: swap`, subset, preload the one above the fold; avoid layout thrash (batch reads then writes; animate only transform/opacity; `content-visibility: auto`); virtualise long lists; debounce/throttle input, scroll and resize handlers; move heavy computation to a Web Worker; cache with HTTP headers and a service worker.

Back-end: the database is usually the bottleneck — add the right index, remove N+1, select fewer columns, paginate; cache hot reads (in-process LRU → Redis) with explicit invalidation; do slow work asynchronously in a queue; pool connections; stream large responses; compress; set timeouts everywhere; scale horizontally only after the single node is efficient.

Algorithms and data structures: know the cost — array scan O(n), hash map/set lookup O(1), sort O(n log n), nested loops O(n²). Typical wins: replace `array.includes` inside a loop with a `Set`; group with a `Map` in one pass; precompute/memoise; binary search on sorted data; heap for top-k; avoid repeated string concatenation in hot loops (join); avoid copying large arrays in each iteration (spread in a reduce is O(n²)).

Memory: release references and listeners, bound caches, stream files instead of reading them whole, watch for closures holding large objects, typed arrays for numeric data.

Games/animation at high refresh rates: allocate nothing per frame, pool objects, cull off-screen work, cap devicePixelRatio, and drive motion by delta time.
