/* Antillusion — the only bridge between the UI and the main process. */
"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("api", {
  /** Calls a main-process handler; rejects with a readable Error when the handler failed. */
  invoke: async (channel, ...args) => {
    const r = await ipcRenderer.invoke(channel, ...args);
    if (r && typeof r === "object" && r.__error) throw new Error(r.__error);
    return r;
  },
  on: (cb) => ipcRenderer.on("evt", (_, e) => cb(e)),
  pathFor: (file) => { try { return webUtils.getPathForFile(file); } catch { return ""; } },
});
