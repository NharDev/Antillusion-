/* Antillusion — a small, safe Markdown renderer (everything is escaped first; only http(s) links become anchors). */
"use strict";

(function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const KW = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|null|undefined|true|false|def|elif|lambda|pass|None|True|False|self|with|as|yield|raise|except|fn|pub|mut|impl|struct|enum|match|use|mod|trait|type|interface|public|private|protected|static|void|int|string|bool|package|func|go|defer|namespace|using|echo|then|fi|done|select|where|insert|update|delete|create|table)\b/g;
  function highlight(code, lang) {
    if (code.length > 60000 || /^(text|txt|plain|log|output)?$/.test(lang || "") && !/[{};=]/.test(code)) return esc(code);
    const hash = /^(py|python|sh|bash|shell|zsh|yaml|yml|toml|rb|ruby|ps1|powershell|dockerfile|r|ini|conf)$/.test(lang);
    const re = new RegExp([
      hash ? "(#[^\\n]*)" : "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)",
      "(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
      "(\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b)",
    ].join("|"), "gi");
    let out = "", last = 0, m;
    const plain = (s) => esc(s).replace(KW, '<span class="k">$1</span>');
    while ((m = re.exec(code))) {
      out += plain(code.slice(last, m.index));
      out += `<span class="${m[1] ? "c" : m[2] ? "s" : "n"}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + plain(code.slice(last));
  }

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0001${codes.length - 1}\u0001`; });
    s = esc(s)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2">$2</a>')
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    return s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  }

  function render(src) {
    const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
    let html = "", i = 0, para = [];
    const flush = () => { if (para.length) { html += `<p>${inline(para.join("\n")).replace(/\n/g, "<br>")}</p>`; para = []; } };
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());

    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)/);
      if (fence) {
        flush();
        const lang = fence[2].toLowerCase(), body = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence[1].slice(0, 3))) body.push(lines[i++]);
        i++;
        html += `<div class="codeblock"><div class="cb-head"><span>${esc(lang || "code")}</span><button class="cb-copy" data-copy>نسخ</button></div><pre dir="ltr"><code>${highlight(body.join("\n"), lang)}</code></pre></div>`;
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      const hd = line.match(/^(#{1,6})\s+(.+)$/);
      if (hd) { flush(); const n = Math.min(hd[1].length + 1, 6); html += `<h${n}>${inline(hd[2])}</h${n}>`; i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flush(); html += "<hr>"; i++; continue; }
      if (/^\s*>/.test(line)) { flush(); const q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, "")); html += `<blockquote>${render(q.join("\n"))}</blockquote>`; continue; }
      if (isRow(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        flush();
        const head = cells(line); i += 2; const rows = [];
        while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
        html += `<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        continue;
      }
      const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flush();
        const stack = [];   // nested lists by indentation
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          if (!m) {
            if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && stack.length) { html += "<br>" + inline(lines[i].trim()); i++; continue; }
            break;
          }
          const ind = m[1].replace(/\t/g, "  ").length, tag = /\d/.test(m[2]) ? "ol" : "ul";
          while (stack.length && stack[stack.length - 1].ind > ind) html += `</li></${stack.pop().tag}>`;
          if (!stack.length || stack[stack.length - 1].ind < ind) { stack.push({ ind, tag }); html += `<${tag}>`; }
          else html += "</li>";
          const task = m[3].match(/^\[([ xX])\]\s+(.*)$/);
          html += `<li>${task ? `<span class="task ${task[1] === " " ? "" : "on"}"></span>${inline(task[2])}` : inline(m[3])}`;
          i++;
        }
        while (stack.length) html += `</li></${stack.pop().tag}>`;
        continue;
      }
      para.push(line); i++;
    }
    flush();
    return html;
  }

  window.MD = { render, esc, highlight };
})();
