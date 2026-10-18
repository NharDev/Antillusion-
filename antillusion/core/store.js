/* Antillusion — persistence: settings, sessions, usage log and the cached model list, all plain JSON under one folder. */
"use strict";

const fs = require("fs");
const path = require("path");
const { uid } = require("./agent");

const DEFAULTS = {
  baseUrl: "https://openrouter.ai/api/v1", model: "poolside/laguna-s-2.1:free", freeOnly: true, expert: false, expertModel: "anthropic/claude-opus-5.5", mode: "agent", perm: "ask", effort: "off",
  shell: "auto", maxTokens: 32000, maxSteps: 80, compactAt: 80, autoPreview: true, sessionBudget: 0, instructions: "", theme: "dark",
  favorites: ["poolside/laguna-s-2.1:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "cohere/north-mini-code:free", "thinkingmachines/inkling:free"],
  lastCwd: "", autoUpdate: true, updateBranch: "",
};

function createStore(dir) {
  const sdir = path.join(dir, "sessions"), ldir = path.join(dir, "library");
  fs.mkdirSync(sdir, { recursive: true }); fs.mkdirSync(ldir, { recursive: true });
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const writeJson = (f, v) => { const tmp = f + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(v)); fs.renameSync(tmp, f); };

  let settings = { ...DEFAULTS, ...readJson(path.join(dir, "settings.json"), {}) };
  let models = readJson(path.join(dir, "models.json"), { at: 0, list: [] });
  let usage = readJson(path.join(dir, "usage.json"), []);
  const sessions = new Map();
  let usageTimer = null;

  const meta = (s) => ({ id: s.id, title: s.title, cwd: s.cwd, baseCwd: s.baseCwd, worktree: s.worktree, model: s.model, mode: s.mode, perm: s.perm, effort: s.effort, rating: s.rating || null, created: s.created, updated: s.updated, usage: s.usage, ctx: s.ctx, todos: s.todos });

  return {
    dir, meta,
    userLibraryDir: () => ldir,
    settings: () => settings,
    setSettings(patch) { settings = { ...settings, ...patch }; writeJson(path.join(dir, "settings.json"), settings); return settings; },

    models: () => models,
    setModels(list) { models = { at: Date.now(), list }; writeJson(path.join(dir, "models.json"), models); },
    modelInfo: (id) => models.list.find((m) => m.id === id),

    listSessions() {
      const out = [];
      for (const f of fs.readdirSync(sdir)) {
        if (!f.endsWith(".json")) continue;
        const id = f.slice(0, -5), s = sessions.get(id) || readJson(path.join(sdir, f), null);
        if (s && s.id) out.push(meta(s));
      }
      return out.sort((a, b) => b.updated - a.updated);
    },
    getSession(id) {
      if (sessions.has(id)) return sessions.get(id);
      const s = readJson(path.join(sdir, id + ".json"), null);
      if (s) { s.allow = { tools: [], cmds: [] }; s.log = s.log || []; s.messages = s.messages || []; sessions.set(id, s); }
      return s;
    },
    createSession(init = {}) {
      const cwd = init.cwd || settings.lastCwd || require("os").homedir();
      const s = { id: uid(), title: "محادثة جديدة", titled: false, cwd, baseCwd: cwd, worktree: null, model: init.model || settings.model, mode: init.mode || settings.mode, perm: init.perm || settings.perm, effort: init.effort || settings.effort,
        messages: [], log: [], todos: [], checkpoints: {}, allow: { tools: [], cmds: [] }, usage: { prompt: 0, completion: 0, cached: 0, cost: 0, requests: 0 }, ctx: { used: 0, max: 0 }, created: Date.now(), updated: Date.now() };
      sessions.set(s.id, s); this.saveSession(s); return s;
    },
    saveSession(s) {
      const { allow, _seen, _fails, _blueprint, _alt, _cur, _chunkHint, _noExpert, _lite, _boost, _lengthRetries, _contRetries, ...rest } = s;
      // checkpoints can be large; keep only the newest 40 on disk
      const keys = Object.keys(rest.checkpoints || {});
      if (keys.length > 40) { rest.checkpoints = Object.fromEntries(keys.slice(-40).map((k) => [k, s.checkpoints[k]])); s.checkpoints = rest.checkpoints; }
      writeJson(path.join(sdir, s.id + ".json"), rest);
    },
    deleteSession(id) { sessions.delete(id); try { fs.unlinkSync(path.join(sdir, id + ".json")); } catch {} },

    addUsage(rec) {
      usage.push(rec); if (usage.length > 20000) usage = usage.slice(-15000);
      clearTimeout(usageTimer); usageTimer = setTimeout(() => writeJson(path.join(dir, "usage.json"), usage), 800);
    },
    usage: () => usage,
    flush() { clearTimeout(usageTimer); writeJson(path.join(dir, "usage.json"), usage); },
  };
}

module.exports = { createStore, DEFAULTS };
