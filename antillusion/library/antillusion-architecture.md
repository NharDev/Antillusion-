# Antillusion Self-Engineering & Architecture Playbook
tags: antillusion, self, architecture, fork, dev, backup, core, electron, agent, tools, store

## Overview
Antillusion is a desktop AI engineering agent powered by Electron, Node.js, and an extensible core architecture.
It features autonomous tools execution, interactive preview tabs, live Playbooks, Git worktree isolation, and safe project self-development.

## Safe Self-Modification Pattern
1. **Immutable Backup**: `antillusion_backup` is created and preserved automatically before any changes occur.
2. **Active Dev Fork**: All self-modifications are performed on `antillusion_dev`.
3. **Inspection Tools**:
   - `project_fork_status`: Verify copy statuses.
   - `project_list_files`: Inspect project directory tree.
   - `project_read_source`: Read any file from the codebase.
   - `project_modify_source` & `project_edit_source`: Safe writes with automated syntax checks.

## Key Files & Roles
- `main.js`: Electron lifecycle, window management, IPC handlers (`chat:send`, `files:search`, `worktree:*`).
- `preload.js`: Secure IPC context bridge (`window.api.invoke`, `window.api.on`).
- `core/agent.js`: The streaming agent loop, tool dispatching, context compression, permissions gate.
- `core/tools.js`: Definitions and implementations of all agent tools (files, shell, server, preview, git, project).
- `core/store.js`: Local persistence (JSON), sessions, settings, models cache, token & cost tracking.
- `core/library.js`: Semantic indexing, playbooks discovery, fast query normalization (English & Arabic).
- `ui/app.js`: Reactive frontend, rendering chat, terminal logs, diff view, responsive preview panel.
- `ui/app.css`: Theme styling (dark / light), typography, responsive layout.

## Adding New Skills or Capabilities
- To add a new skill/tool:
  1. Add specification to `DEFS` array in `core/tools.js` with `P()`, `S()`, `N()`, `B()`.
  2. Implement execution logic in `impl` in `core/tools.js`.
  3. Ensure `approvalNeeded` in `core/agent.js` checks appropriate permissions.
  4. Write a corresponding reference playbook in `library/` if applicable.


## Skills, templates and tools added later (know these about yourself)
- **Skills** (`skills/*.md`, user ones in `<userData>/skills`, per-project in `.antillusion/skills`): header (name, title, command, triggers, refs, template, brief, example) + a workflow body. Built-in: `/video` motion-video, `/story` story-cinematic, `/game` game-dev, `/project` project-builder, `/design` ui-design, `/spec` spec, `/review`, `/fix`. A skill switches on when the user types its slash command or a strong keyword match (`core/skills.js: match`); its workflow, referenced playbooks and starter template are injected into the user message as `<skill>`, `<library_reference>` and `<starter_template>` blocks. Users can add their own by dropping a `.md` file there.
- **Prompt expansion**: the ✨ button / `/expand` calls `agent.expandPrompt` (one non-streaming model call) and puts a structured brief back into the composer for the user to edit.
- **Plan mode** (`/plan`): read-only; outputs goal, scope, architecture, milestones (published with `todo_write`), risks, open questions; the user presses *Execute plan*.
- **Faster editing tools**: `multi_edit` (several exact-string edits in ONE file, atomic, one call) and `read_many` (up to 12 files per call). Prefer them over repeated `edit_file`/`read_file`.
- **Template `motion-video`**: canvas motion-graphics + cinematic engine (Motion/Cine globals, scenes.js, scenes-cinematic.js, render.mjs for MP4 via Playwright + ffmpeg). Playbooks: `motion-video`, `cinematic-direction`, `storytelling`, `game-architecture`, `game-systems`, `game-feel`, `godot-unity-unreal`, `project-planning`.
- **Updates & version**: the app checks GitHub (git checkouts fast-forward; installed copies download the tiny Setup.exe and apply it on restart/quit); the bottom-corner badge shows `v<version> · #<build> · <commit>`; `Antillusion-Setup.exe` installs the app, then Node/Git/OmniRoute finish in the background (flags `runtime/node.installing`, `runtime/git.installing`).
