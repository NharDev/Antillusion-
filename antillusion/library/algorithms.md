# Algorithms and data structures cheat sheet
tags: algorithm data structure sort search graph tree dp recursion complexity leetcode pathfinding خوارزميه خوارزميات هياكل بيانات ترتيب بحث

Choose by the question asked:
- "Have I seen this?" / count / dedupe → hash set or map, O(1) per operation.
- Sorted data, "find first ≥ x", minimise a monotonic answer → binary search, O(log n). Template: `lo=0, hi=n; while (lo<hi) { mid=(lo+hi)>>1; if (ok(mid)) hi=mid; else lo=mid+1; } return lo`.
- Top-k / next smallest repeatedly / scheduling → heap (priority queue), O(log n) push/pop.
- Subarray / substring with a property → sliding window (two pointers), O(n). Range sums → prefix sums.
- Grid or graph reachability / shortest steps (unweighted) → BFS with a queue and a visited set. Weighted non-negative → Dijkstra with a heap. Game pathfinding → A* (Dijkstra + heuristic: Manhattan on 4-way grids, octile on 8-way).
- Dependencies / build order → topological sort (Kahn: queue of zero in-degree nodes); cycle if not all nodes are output.
- Connected groups / "are these linked" with merges → union-find with path compression.
- Hierarchies → tree recursion (DFS); level-by-level → BFS.
- "Number of ways" / "minimum cost" with overlapping subproblems → dynamic programming: define state, transition, base case; memoise top-down or fill bottom-up; reduce memory to the last row when possible.
- All combinations/permutations under constraints (sudoku, N-queens) → backtracking with early pruning.
- Intervals (merge, overlap, rooms) → sort by start, sweep.
- Strings: prefix lookups → trie; fuzzy match → Levenshtein DP; pattern search → built-in `indexOf`/regex first.
- Geometry in games: AABB overlap, circle overlap, point-in-rect, line-of-sight via grid ray march (DDA), spatial hash for broad phase.
- Randomness: Fisher–Yates shuffle (`for i=n-1..1: j=rand(0..i); swap`), weighted pick by cumulative sums, seeded PRNG (mulberry32) for reproducible worlds.
- Procedural terrain: value/Perlin/simplex noise layered in octaves (`sum += noise(x*f, y*f) * a; f*=2; a*=.5`).

Complexity to remember: sort O(n log n); nested loops over the same data O(n²) — at n = 10⁵ that is too slow, find a map/sort-based approach; recursion depth limits (~10⁴ frames in JS, 10³ in Python) → convert deep recursion to an explicit stack.

A* on a grid (compact):
```js
function astar(start, goal, passable, w, h) {
  const key = (p) => p.y * w + p.x, hfn = (p) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
  const open = [start], came = new Map(), g = new Map([[key(start), 0]]);
  while (open.length) {
    open.sort((a, b) => g.get(key(a)) + hfn(a) - g.get(key(b)) - hfn(b));       // fine for small grids; use a heap for big ones
    const cur = open.shift();
    if (cur.x === goal.x && cur.y === goal.y) { const path = [cur]; let k = key(cur); while (came.has(k)) { const p = came.get(k); path.unshift(p); k = key(p); } return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: cur.x + dx, y: cur.y + dy }; if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h || !passable(n.x, n.y)) continue;
      const cost = g.get(key(cur)) + 1;
      if (cost < (g.get(key(n)) ?? Infinity)) { g.set(key(n), cost); came.set(key(n), cur); if (!open.some((o) => o.x === n.x && o.y === n.y)) open.push(n); }
    }
  }
  return null;
}
```
Always test with the empty input, one element, duplicates, already-sorted and the maximum size.
