# Data, files and automation scripts
tags: data csv json excel pandas parse scrape automation script etl file convert regex pdf بيانات ملفات اكسل csv تحويل استخراج

Pick the lightest tool: a one-off transformation is a short script (Node or Python) run with run_command — write it to a file, run it, check the output, keep or delete it.

Reading formats: JSON (`JSON.parse` / `json.load`; newline-delimited JSON line by line for big files), CSV (never split on commas by hand — papaparse / `csv` module / pandas; mind the BOM, delimiters, quoting, encodings — Arabic CSVs from Excel are often cp1256 or need `utf-8-sig`), Excel (openpyxl / pandas `read_excel`; exceljs or SheetJS in JS), PDF text (pdfplumber, pymupdf, pdfjs-dist), HTML (BeautifulSoup/selectolax, cheerio), YAML/TOML (pyyaml / `tomllib`, `yaml` / `smol-toml`).

pandas quick map: `df = pd.read_csv(p)`; inspect `df.head()`, `df.info()`, `df.describe()`, `df.isna().sum()`; filter `df[df.amount > 0]`; derive `df["total"] = df.qty * df.price`; group `df.groupby("city", as_index=False).agg(total=("amount","sum"), n=("id","count"))`; join `df.merge(other, on="id", how="left")`; reshape `pivot_table`, `melt`; dates `pd.to_datetime(df.d, errors="coerce")`, `df.set_index("d").resample("W").sum()`; write `to_csv(index=False)`, `to_excel`, `to_parquet`. Polars is the faster alternative with a similar expression API; DuckDB runs SQL directly over CSV/Parquet files.

Cleaning checklist: trim whitespace, normalise case and Unicode (NFKC; Arabic: unify alef/ya/ta-marbuta forms and strip tatweel/diacritics when matching), parse numbers with locale separators, parse dates explicitly, deduplicate on a key, validate ranges, report how many rows were dropped and why.

Regex: anchor (`^…$`), prefer specific classes over `.*`, non-greedy `.*?`, named groups, the `u` flag for Unicode (`\p{L}`), test on real samples; do not parse HTML/JSON with regex.

Scraping etiquette and robustness: check for an official API or data export first; respect robots.txt and terms; identify with a User-Agent; rate-limit and cache; handle pagination, retries and changed markup; use Playwright only when the content needs JavaScript.

Automation scripts: idempotent (safe to re-run), dry-run flag for anything destructive, log what was done, paths from arguments/config instead of hard-coded, exit non-zero on failure. Scheduling: cron / Task Scheduler / GitHub Actions `schedule`.

Charts from data: matplotlib/seaborn or plotly in Python (save to PNG/HTML), Chart.js/ECharts in a page — and open the result in the preview panel so the user sees it.
