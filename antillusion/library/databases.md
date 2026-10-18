# Databases, SQL and data modelling
tags: sql database postgres sqlite mysql schema migration index orm prisma drizzle sqlalchemy query transaction mongodb redis قاعده بيانات جداول استعلام تخزين

Choose: SQLite (single node, files, tests, desktop/mobile, surprisingly far in production with WAL), PostgreSQL (default for services), Redis (cache, rate limits, queues, sessions), a document store only when the data really is schemaless.

Modelling: one table per entity; surrogate primary key (`id` bigint identity or UUIDv7); foreign keys with `ON DELETE` rules; `NOT NULL` by default; `created_at`/`updated_at timestamptz`; money as integer minor units or `numeric`; enums as check constraints or lookup tables; many-to-many through a join table with a composite primary key; unique constraints for natural keys (email). Normalise first, denormalise only with a measured reason.

Queries: ALWAYS parameterised (`WHERE id = $1` / `?`) — never string-built. Select only needed columns. Index what you filter, join and order by; composite index column order = equality columns first, then range/sort. `EXPLAIN (ANALYZE)` slow queries. Avoid N+1 (join, `IN (…)`, or the ORM's eager loading). Keyset pagination (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`) over large OFFSETs.

Transactions: wrap multi-statement changes; keep them short; handle unique-violation as a normal outcome (upsert: `INSERT … ON CONFLICT (…) DO UPDATE`). Use `SELECT … FOR UPDATE` or optimistic versions for read-modify-write.

Migrations: every schema change is a versioned, forward migration checked into git (drizzle-kit, prisma migrate, alembic, Django, knex, sqlx). Never edit an applied migration. Expand → backfill → contract for zero-downtime changes.

SQLite specifics: `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;` Node: `better-sqlite3` (sync, fast) or `node:sqlite`. Python: stdlib `sqlite3`. Full-text search via FTS5.

Postgres specifics: `jsonb` + GIN index for flexible attributes, `tsvector` for search, `pgvector` for embeddings, `LISTEN/NOTIFY` for light pub/sub, row-level security for multi-tenant, connection pooling (pgbouncer / pool size ≈ cores × 2).

ORMs: Drizzle (SQL-shaped, typed) or Prisma (schema file + generated client) in TS; SQLAlchemy 2 (`select(User).where(…)`, `Session` per request) in Python. Keep raw SQL available for reports.

Redis patterns: cache-aside with TTL, `SET key val NX EX n` for locks/idempotency, sorted sets for leaderboards/rate windows, streams or BullMQ for jobs.
