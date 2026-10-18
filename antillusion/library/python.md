# Python projects (tooling, FastAPI, scripts)
tags: python pip venv uv fastapi flask django pydantic typing pytest async script cli بايثون سكربت

Environment: one venv per project. `python -m venv .venv` then call it explicitly (`.venv/Scripts/python` on Windows, `.venv/bin/python` elsewhere) — do not rely on activation persisting between commands. With uv: `uv init`, `uv add fastapi`, `uv run main.py`. Pin dependencies in `pyproject.toml` (or `requirements.txt` for small scripts). Format/lint with ruff; type-check with pyright or mypy.

Style: type hints everywhere; `pathlib.Path` over os.path; f-strings; dataclasses or pydantic models for structured data; context managers for resources; `logging` not print in libraries; `if __name__ == "__main__": main()`; raise specific exceptions, never bare `except:`.

FastAPI skeleton:
```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
app = FastAPI()
class TodoIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
@app.post("/todos", status_code=201)
async def create(todo: TodoIn, db = Depends(get_db)) -> Todo: ...
```
Layout for bigger apps: `app/main.py`, `app/api/routes/*.py` (APIRouter), `app/models.py` (SQLAlchemy/SQLModel), `app/schemas.py` (pydantic), `app/services/`, `app/core/config.py` (pydantic-settings reading `.env`), `alembic/` migrations, `tests/`. Use `lifespan` for startup/shutdown, dependency injection for db sessions and current user, `BackgroundTasks` or a queue for slow work. Blocking libraries inside `async def` stall the loop — use `def` endpoints or `run_in_threadpool`.

Django: `startproject` + `startapp`; models → `makemigrations` → `migrate`; class-based or function views; DRF serializers/viewsets for APIs; never edit applied migrations; `select_related`/`prefetch_related` to kill N+1.

CLI tools: typer (`app = typer.Typer()`; `@app.command()`), rich for output. Packaging: `[project.scripts]` in pyproject.

Tests: pytest — plain `assert`, fixtures in `conftest.py`, `tmp_path` for files, `monkeypatch` for env, `httpx.AsyncClient`/`TestClient` for APIs, `pytest -q -x` to stop at first failure.

Data work: pandas/polars — vectorise instead of looping rows; `read_csv(..., dtype=…, parse_dates=…)`; save figures with `plt.savefig("out.png", dpi=150, bbox_inches="tight")` (headless: `matplotlib.use("Agg")`).
