/* Antillusion — live sources: package registries, GitHub, Stack Overflow, MDN, the open web. No API keys needed. */
"use strict";

const UA = "Antillusion/1.0 (desktop coding agent)";

async function get(url, { json = true, timeout = 15000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: json ? "application/json" : "text/html,*/*", ...headers }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return json ? r.json() : r.text();
}
const q = encodeURIComponent;
const cut = (s, n = 180) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const unent = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const SOURCES = {
  async npm(s) {
    const d = await get(`https://registry.npmjs.org/-/v1/search?text=${q(s)}&size=8`);
    return d.objects.map((o) => `${o.package.name}@${o.package.version} — ${cut(o.package.description)}\n   npm i ${o.package.name} · ${o.package.links.repository || o.package.links.npm}`);
  },
  async pypi(s) {
    const name = s.trim().split(/\s+/)[0];
    try { const d = await get(`https://pypi.org/pypi/${q(name)}/json`); return [`${d.info.name} ${d.info.version} — ${cut(d.info.summary)}\n   pip install ${d.info.name} · ${d.info.home_page || d.info.project_url}`]; }
    catch { return (await SOURCES.web(`${s} python package site:pypi.org`)); }
  },
  async crates(s) {
    const d = await get(`https://crates.io/api/v1/crates?q=${q(s)}&per_page=8`);
    return d.crates.map((c) => `${c.name} ${c.max_stable_version || c.max_version} — ${cut(c.description)}\n   cargo add ${c.name} · ${c.downloads.toLocaleString()} downloads · ${c.repository || "https://crates.io/crates/" + c.name}`);
  },
  async nuget(s) {
    const d = await get(`https://azuresearch-usnc.nuget.org/query?q=${q(s)}&take=8`);
    return d.data.map((p) => `${p.id} ${p.version} — ${cut(p.description)}\n   dotnet add package ${p.id} · ${(p.totalDownloads || 0).toLocaleString()} downloads`);
  },
  async packagist(s) {
    const d = await get(`https://packagist.org/search.json?q=${q(s)}&per_page=8`);
    return d.results.map((p) => `${p.name} — ${cut(p.description)}\n   composer require ${p.name} · ${p.repository}`);
  },
  async pub(s) {
    const d = await get(`https://pub.dev/api/search?q=${q(s)}`);
    return d.packages.slice(0, 10).map((p) => `${p.package}\n   flutter pub add ${p.package} · https://pub.dev/packages/${p.package}`);
  },
  async docker(s) {
    const d = await get(`https://hub.docker.com/v2/search/repositories/?query=${q(s)}&page_size=8`);
    return d.results.map((r) => `${r.repo_name}${r.is_official ? " (official)" : ""} — ${cut(r.short_description)}\n   docker pull ${r.repo_name} · ★${r.star_count}`);
  },
  async github(s) {
    const d = await get(`https://api.github.com/search/repositories?q=${q(s)}&per_page=8&sort=stars`, { headers: { Accept: "application/vnd.github+json" } });
    return d.items.map((r) => `${r.full_name} ★${r.stargazers_count.toLocaleString()} [${r.language || "?"}] — ${cut(r.description)}\n   ${r.html_url} · updated ${String(r.pushed_at).slice(0, 10)}`);
  },
  async stackoverflow(s) {
    const d = await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${q(s)}&site=stackoverflow&pagesize=7`);
    return d.items.map((i) => `${unent(i.title)} — score ${i.score}, ${i.answer_count} answers${i.is_answered ? " ✓" : ""}\n   ${i.link}`);
  },
  async mdn(s) {
    const d = await get(`https://developer.mozilla.org/api/v1/search?q=${q(s)}&locale=en-US`);
    return d.documents.slice(0, 7).map((x) => `${x.title} — ${cut(x.summary)}\n   https://developer.mozilla.org${x.mdn_url}`);
  },
  async wikipedia(s) {
    const d = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q(s)}&format=json&srlimit=6`);
    return d.query.search.map((x) => `${x.title} — ${cut(unent(x.snippet.replace(/<[^>]+>/g, "")))}\n   https://en.wikipedia.org/wiki/${q(x.title.replace(/ /g, "_"))}`);
  },
  async web(s) {
    const html = await get(`https://html.duckduckgo.com/html/?q=${q(s)}`, { json: false, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" } });
    const out = [], re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
    let m;
    while ((m = re.exec(html)) && out.length < 8) {
      let href = unent(m[1]); const u = href.match(/[?&]uddg=([^&]+)/); if (u) href = decodeURIComponent(u[1]);
      if (/duckduckgo\.com\/y\.js/.test(href)) continue;
      out.push(`${unent(m[2].replace(/<[^>]+>/g, ""))}\n   ${href}${m[3] ? "\n   " + cut(unent(m[3].replace(/<[^>]+>/g, "")), 220) : ""}`);
    }
    return out;
  },
};

async function search(source, query) {
  source = String(source || "all").toLowerCase();
  const names = source === "all" ? ["web", "github", "npm", "stackoverflow", "mdn"] : [source];
  if (!names.every((n) => SOURCES[n])) return `Unknown source "${source}". Available: ${Object.keys(SOURCES).join(", ")}, all.`;
  const parts = await Promise.all(names.map(async (n) => {
    try { const r = await SOURCES[n](query); return `## ${n}\n${r.length ? r.map((x, i) => `${i + 1}. ${x}`).join("\n") : "(no results)"}`; }
    catch (e) { return `## ${n}\n(unavailable: ${e.message})`; }
  }));
  return parts.join("\n\n") + "\n\nOpen any link with web_fetch to read it.";
}

async function pkgInfo(eco, name) {
  eco = String(eco).toLowerCase();
  try {
    if (eco === "npm") {
      const d = await get(`https://registry.npmjs.org/${name.startsWith("@") ? "@" + q(name.slice(1)) : q(name)}`, { timeout: 25000 });
      const latest = d["dist-tags"].latest, v = d.versions[latest] || {};
      const deps = (o) => Object.entries(o || {}).map(([k, x]) => `${k}@${x}`).join(", ") || "none";
      return `${d.name}@${latest} (published ${String((d.time || {})[latest]).slice(0, 10)})\n${d.description || ""}\ninstall: npm i ${d.name}\nlicense: ${v.license || d.license || "?"} · module type: ${v.type || "commonjs"}${v.types || v.typings ? " · ships types" : ""}\nhomepage: ${d.homepage || "-"}\nrepository: ${(d.repository && d.repository.url) || "-"}\nother tags: ${Object.entries(d["dist-tags"]).filter(([k]) => k !== "latest").map(([k, x]) => `${k}=${x}`).join(", ") || "-"}\nengines: ${JSON.stringify(v.engines || {})}\ndependencies: ${deps(v.dependencies)}\npeerDependencies: ${deps(v.peerDependencies)}\n\n--- README (excerpt) ---\n${String(d.readme || "(none)").slice(0, 7000)}`;
    }
    if (eco === "pypi" || eco === "pip" || eco === "python") {
      const d = await get(`https://pypi.org/pypi/${q(name)}/json`), i = d.info;
      return `${i.name} ${i.version}\n${i.summary || ""}\ninstall: pip install ${i.name}\nrequires python: ${i.requires_python || "?"} · license: ${cut(i.license, 60) || "?"}\nlinks: ${Object.entries(i.project_urls || {}).map(([k, x]) => `${k}: ${x}`).join(" · ") || i.home_page}\nrequires: ${(i.requires_dist || []).slice(0, 25).join("; ") || "none"}\n\n--- description (excerpt) ---\n${String(i.description || "").slice(0, 7000)}`;
    }
    if (eco === "crates" || eco === "cargo" || eco === "rust") {
      const d = await get(`https://crates.io/api/v1/crates/${q(name)}`), c = d.crate;
      return `${c.name} ${c.max_stable_version || c.max_version}\n${c.description || ""}\ninstall: cargo add ${c.name}\ndocs: ${c.documentation || "https://docs.rs/" + c.name}\nrepository: ${c.repository || "-"}\ndownloads: ${c.downloads.toLocaleString()}\nrecent versions: ${d.versions.slice(0, 6).map((v) => v.num).join(", ")}`;
    }
    return `pkg_info supports npm, pypi and crates. For ${eco} use sources_search.`;
  } catch (e) { return `Could not load ${eco} package "${name}": ${e.message}. Check the name with sources_search.`; }
}

function htmlToText(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|iframe|template|nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, "");
  const main = s.match(/<(main|article)\b[\s\S]*<\/\1>/i); if (main && main[0].length > 1500) s = main[0];
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => "\n```\n" + c.replace(/<[^>]+>/g, "") + "\n```\n")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => "`" + c.replace(/<[^>]+>/g, "") + "`")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, c) => "\n\n" + "#".repeat(+n) + " " + c.replace(/<[^>]+>/g, "").trim() + "\n")
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, c) => { const t = c.replace(/<[^>]+>/g, "").trim(); return t ? `${t} (${h})` : ""; })
    .replace(/<li\b[^>]*>/gi, "\n- ").replace(/<(br|\/p|\/div|\/tr|\/h\d|\/section|\/table)\b[^>]*>/gi, "\n").replace(/<\/t[dh]>/gi, " | ").replace(/<[^>]+>/g, "");
  return unent(s).replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchPage(url, max = 20000) {
  url = String(url).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const gh = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/); if (gh) url = `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antillusion/1.0", Accept: "text/html,application/json,text/plain,*/*" }, signal: AbortSignal.timeout(25000), redirect: "follow" });
    const type = r.headers.get("content-type") || "";
    if (/^(image|audio|video|font)\/|octet-stream|zip|pdf/.test(type)) return `HTTP ${r.status} · ${type} — binary content, not readable as text.`;
    const body = await r.text();
    const text = /html/.test(type) || /^\s*<(!doctype|html)/i.test(body) ? htmlToText(body) : body;
    return `HTTP ${r.status} · ${r.url}\n\n` + (text.length > max ? text.slice(0, max) + `\n\n…[truncated at ${max} of ${text.length} characters]` : text || "(empty body)");
  } catch (e) { return `Fetch failed for ${url}: ${e.cause && e.cause.code ? e.cause.code : e.message}`; }
}

module.exports = { search, pkgInfo, fetchPage, htmlToText, SOURCE_NAMES: Object.keys(SOURCES) };
