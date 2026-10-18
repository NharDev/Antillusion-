---
name: spec
title: توسيع الفكرة وخطة التنفيذ
icon: list
command: spec
description: يحوّل فكرة غامضة إلى مواصفات واضحة وخطة مراحل بمعايير قبول، ثم ينتظر اعتمادك
triggers: write a spec, requirements, project plan, roadmap, expand my idea, اكتب خطه, خطه تنفيذ, وسع الفكره, حلل الفكره, متطلبات المشروع, خارطه طريق
refs: project-planning
brief: users, must/should/could scope, flows, data model, architecture, milestones with acceptance checks, risks
example: عندي فكرة تطبيق لتعلّم اللغات بالألعاب — حوّلها لخطة كاملة
---
Turn the idea into a precise, buildable plan. Do NOT write code now.

Produce exactly these sections (concise, concrete, no filler):
1. **Idea in one sentence** and the problem it solves; target users.
2. **Assumptions** you made (list them so the user can correct them).
3. **Scope** — Must (MVP) / Should / Could / Won't (for now).
4. **User flows** — the 3–5 main journeys as numbered steps.
5. **Architecture** — stack with reasons, components, data model (entities + key fields), external services, risks.
6. **Milestones** — each with a deliverable, the files/areas touched and an acceptance test written as "Given/When/Then" or a checklist; order them so every milestone leaves a runnable product.
7. **Open questions** — at most 3, only those that change the build.

Then publish the milestones with `todo_write` and end with: "جاهز للتنفيذ — اضغط «نفّذ الخطة» أو عدّل أي نقطة." Be ready to refine when the user edits.
