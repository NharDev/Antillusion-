# Git workflow, worktrees and recovery
tags: git branch commit merge rebase worktree stash conflict github pull request undo reset revert جيت فروع دمج مستودع

Daily: `git status -sb`, `git diff`, `git add -p` (non-interactive alternative: add specific paths), `git commit -m "type: summary"` (conventional types: feat, fix, refactor, docs, test, chore, perf), small focused commits. Branch per task: `git switch -c feat/x`.

Inspect: `git log --oneline --graph -20`, `git show <sha>`, `git blame -L 10,30 file`, `git log -S"needle" -- path` (when did this string appear), `git diff main...HEAD` (what this branch adds), `git bisect start/bad/good`.

Sync: `git fetch`, `git pull --rebase`, `git push -u origin HEAD`. Merge conflict: open the files, resolve the `<<<<<<<` blocks keeping the intent of both sides, `git add`, then `git merge --continue` / `git rebase --continue`; `--abort` backs out.

Worktrees (parallel checkouts of one repo — what this app's "worktree" switch uses): `git worktree add ../repo.worktrees/feat-x -b feat-x`, `git worktree list`, `git worktree remove ../repo.worktrees/feat-x`. Each has its own files and index but shares history; a branch can be checked out in only one worktree. Dependencies (node_modules, venv) are per worktree — install again.

Undo safely: unstage `git restore --staged f`; discard one file's edits `git restore f` (destructive for that file — confirm); amend last unpushed commit `git commit --amend`; undo a pushed commit with `git revert <sha>`; find lost work with `git reflog`. Park work: `git stash push -m "msg"`, `git stash pop`.

Never without the user's explicit request: `git reset --hard`, `git clean -fd`, `git push --force` (if truly needed: `--force-with-lease`), rewriting shared history, committing or pushing at all.

.gitignore from the start: dependencies, build output, `.env`, editor folders, OS files, logs. GitHub CLI: `gh repo create`, `gh pr create --fill`, `gh pr view --web`, `gh run watch`.
