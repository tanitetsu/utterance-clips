const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (patch) => ipcRenderer.invoke("config:save", patch),
  openAudio: () => ipcRenderer.invoke("dialog:openAudio"),
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  runPipeline: (sourceFile) => ipcRenderer.invoke("pipeline:run", { sourceFile }),
  onPipelineProgress: (handler) => {
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on("pipeline:progress", listener);
    return () => ipcRenderer.removeListener("pipeline:progress", listener);
  },
  listProject: (projectDir) => ipcRenderer.invoke("project:list", projectDir),
  updateTitle: (projectDir, segmentId, title) =>
    ipcRenderer.invoke("project:updateTitle", { projectDir, segmentId, title }),
  deleteSegment: (projectDir, segmentId) =>
    ipcRenderer.invoke("project:delete", { projectDir, segmentId }),
  mergeSegments: (projectDir, leftId, rightId) =>
    ipcRenderer.invoke("project:merge", { projectDir, leftId, rightId }),
  revealProject: (projectDir) => ipcRenderer.invoke("project:reveal", projectDir),
});
