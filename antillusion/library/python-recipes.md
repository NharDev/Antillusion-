# Python recipes: scripts, FastAPI + SQLite, data, automation
tags: python fastapi flask script automation sqlite pandas requests cli بايثون سكربت اتمته تحليل بيانات خادم

Run Python reliably here: create the venv once (`python -m venv .venv`), then always call its interpreter by path — Windows `.venv/Scripts/python`, others `.venv/bin/python` — e.g. `.venv/Scripts/python -m pip install fastapi uvicorn` and `.venv/Scripts/python -m uvicorn main:app --port 8000` (via start_server). Check `python --version` first; if Python is missing say so.

FastAPI + SQLite CRUD in one file:
```python
import sqlite3
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Todos")
DB = "data.db"

@contextmanager
def db():
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    try:
        yield con; con.commit()
    finally:
        con.close()

with db() as con:
    con.execute("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)")

class TodoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    done: bool = False

@app.get("/api/todos")
def list_todos(limit: int = 20, offset: int = 0):
    with db() as con:
        return {"items": [dict(r) for r in con.execute("SELECT * FROM todos ORDER BY id DESC LIMIT ? OFFSET ?", (min(limit, 100), offset))]}

@app.post("/api/todos", status_code=201)
def create(todo: TodoIn):
    with db() as con:
        cur = con.execute("INSERT INTO todos (title, done) VALUES (?, ?)", (todo.title, int(todo.done)))
        return {"id": cur.lastrowid, **todo.model_dump()}

@app.delete("/api/todos/{todo_id}", status_code=204)
def delete(todo_id: int):
    with db() as con:
        if con.execute("DELETE FROM todos WHERE id = ?", (todo_id,)).rowcount == 0:
            raise HTTPException(404, "not found")
```
Interactive docs appear at `/docs`. Serve a front-end from the same app: `app.mount("/", StaticFiles(directory="static", html=True))` (after the API routes).

Scripts: `argparse` for flags, `pathlib.Path` for files (`Path("out").mkdir(exist_ok=True)`, `p.read_text(encoding="utf-8")`), `json.loads/dumps(ensure_ascii=False, indent=2)` so Arabic stays readable, `csv.DictReader(open(p, newline="", encoding="utf-8-sig"))`, `subprocess.run([...], check=True, capture_output=True, text=True)`, `logging.basicConfig(level=logging.INFO)`.

HTTP client: `httpx.get(url, timeout=10).raise_for_status().json()`; async with `httpx.AsyncClient()` + `asyncio.gather`.

Data: pandas `read_csv` → clean → `groupby().agg()` → `to_csv(index=False)`; plots with matplotlib using `matplotlib.use("Agg")` and `plt.savefig("chart.png", dpi=150, bbox_inches="tight")`, then show the PNG/HTML in the preview. Arabic text in matplotlib needs `arabic-reshaper` + `python-bidi` and a font that has Arabic glyphs.

Desktop quick wins: tkinter/customtkinter for a small GUI, `pyinstaller --onefile --noconsole app.py` for an exe. Bots/automation: `schedule` or OS scheduler; secrets from environment variables (`os.environ["TOKEN"]`), never in the file.

Tests: `pytest -q`; FastAPI with `from fastapi.testclient import TestClient`.
