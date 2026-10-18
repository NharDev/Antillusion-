---
name: fix
title: تصحيح الأخطاء بمنهجية
icon: bolt
command: fix
description: يشخّص الخطأ من الجذر بدل التخمين: يعيد الإنتاج، يعزل، يصلح، يتحقق
triggers: fix this bug, debug, not working, error, crash, exception, stack trace, broken, لا يعمل, مشكله, خطا, يظهر خطا, تعطل, كراش, ما يشتغل, ما اشتغل, صلح
refs: debugging, error-catalogue
example: التطبيق يعطي Cannot read properties of undefined عند الضغط على حفظ — اعثر على السبب وأصلحه
---
Debug with the scientific method, not guesses.
1. **Reproduce**: get the exact error/steps (run the command, `preview_read`, read logs with `server_logs`). No reproduction → add logging/ask for the minimal missing detail.
2. **Read the evidence**: the first error in the log (not the last), the full stack trace, the line it points at, and the code that produced its inputs (`read_many`).
3. **Form 1–3 hypotheses** ranked by likelihood; test the cheapest first with a targeted check (log, assertion, tiny script), never by changing random things.
4. **Fix the root cause**, not the symptom; keep the change minimal; add a regression test when a test setup exists.
5. **Verify**: rerun the original failing action + the test suite/build. Say what the cause was in one or two sentences.
If something failed twice, change approach (and use `ask_expert` if available).
