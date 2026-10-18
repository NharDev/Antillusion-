# Charts and dashboards
tags: chart graph dashboard analytics statistics visualization chart.js echarts d3 table kpi رسم بياني مخطط لوحه تحكم احصائيات تحليلات تقارير جدول

Fastest reliable route without a build — Chart.js from CDN:
```html
<canvas id="c" height="120"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById("c"), {
  type: "line",                                             // bar | line | doughnut | pie | radar | scatter
  data: { labels: ["Jan", "Feb", "Mar", "Apr"], datasets: [{ label: "Revenue", data: [12, 19, 14, 23], borderColor: "#4f8cff", backgroundColor: "#4f8cff22", fill: true, tension: .35 }] },
  options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, grid: { color: "#8882" } }, x: { grid: { display: false } } } }
});
</script>
```
Put the canvas in a wrapper with a fixed height (`position:relative; height:320px`) or it grows forever. Update: mutate `chart.data` then `chart.update()`. RTL: `options.plugins.legend.rtl = true`, `scales.x.reverse = true`. React: `react-chartjs-2` or Recharts (`<ResponsiveContainer><LineChart data={rows}>…`). Heavy/interactive: ECharts; bespoke: D3 (scales + axes + path generators).

Choosing the chart: change over time → line/area; compare categories → bar (horizontal when labels are long; sort it); part of whole → stacked bar or a doughnut with ≤ 5 slices; distribution → histogram/box; relationship → scatter; a single number → KPI card with delta vs previous period. Start axes at zero for bars; label units; no 3D, no dual axes unless unavoidable; colour-blind-safe palette with one highlight colour.

Dashboard layout: KPI row (4 cards: value, label, ▲▼ change), main trend chart wide, two secondary charts, recent-activity table. `display:grid; grid-template-columns:repeat(12, 1fr); gap:1rem` with spans, collapsing to one column on phones. Filters (date range, segment) at the top drive every widget from one state object; show skeletons while loading and an empty state when there is no data.

Data table essentials: sticky header, sortable columns (`aria-sort`), text search (debounced), pagination or virtual scroll beyond ~500 rows, right-aligned tabular numbers, row actions, CSV export (`Blob` + `URL.createObjectURL`).

Numbers: format with `Intl.NumberFormat` (compact notation for big values: `{ notation: "compact" }`), percentages with one decimal, dates in the user's locale.
