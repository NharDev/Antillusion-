---
name: review
title: مراجعة الكود
icon: shield
command: review
description: يراجع الكود بحثاً عن أخطاء وثغرات ومشاكل أداء وتصميم ويقدّم إصلاحات مرتبة بالأهمية
triggers: review my code, code review, find bugs, audit, security review, راجع الكود, مراجعه كود, ابحث عن اخطاء, فحص الكود, ثغرات
refs: debugging, auth-security, performance
example: راجع هذا المشروع وأعطني أهم 10 مشاكل مرتبة بالخطورة مع الإصلاح
---
Review like a senior engineer: find real problems, not style nits.
1. Map the project (list_dir depth 2, manifest, entry points) then read the riskiest files first (auth, input handling, data access, concurrency, money/permissions) with `read_many`.
2. Look for: correctness bugs (off-by-one, null/undefined, race conditions, wrong async handling), security (injection, XSS, secrets, auth gaps, path traversal, SSRF, unsafe deserialisation), data loss, error handling, performance traps (N+1, sync I/O in hot paths, leaks), maintainability issues that will bite soon.
3. Verify each suspected bug by reading the exact code path or running a tiny reproduction; drop what you cannot substantiate.
4. Report as a ranked list: **severity · file:line · what is wrong · concrete failure scenario · minimal fix**. Group by Critical / High / Medium / Low, max ~15 items.
5. If the user asked to fix: apply fixes smallest-first with `multi_edit`, run the tests/build, and summarise what changed.
