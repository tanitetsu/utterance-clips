const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { getUserDataDir } = require("../src/lib/paths.cjs");
const { loadConfig, saveConfig } = require("../src/lib/config.cjs");
const { runPipeline } = require("../src/lib/pipeline.cjs");
const {
  updateTitle,
  deleteSegment,
  mergeSegments,
  listActiveForUi,
} = require("../src/lib/editOps.cjs");
const { readMeta } = require("../src/lib/meta.cjs");

let mainWindow = null;
const userDataDir = () => getUserDataDir(app);

function resolveAppIcon() {
  const ico = path.join(__dirname, "../assets/icon.ico");
  const png = path.join(__dirname, "../assets/icon.png");
  if (process.platform === "win32" && fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

function createWindow() {
  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: "utterance-clips",
  });

  mainWindow.loadFile(path.join(__dirname, "../src/renderer/index.html"));
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("pipeline:progress", payload);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("config:get", async () => loadConfig(userDataDir()));

ipcMain.handle("config:save", async (_e, patch) => saveConfig(userDataDir(), patch || {}));

ipcMain.handle("dialog:openAudio", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "音声ファイルを選択",
    properties: ["openFile"],
    filters: [
      { name: "Audio", extensions: ["wav", "mp3", "m4a", "mp4", "aac", "flac", "ogg", "wma"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:openProject", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "処理済みフォルダを開く",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const dir = result.filePaths[0];
  if (!fs.existsSync(path.join(dir, "meta.json"))) {
    throw new Error("このフォルダに meta.json がありません");
  }
  return listActiveForUi(dir);
});

ipcMain.handle("pipeline:run", async (_e, { sourceFile }) => {
  const cfg = loadConfig(userDataDir());
  if (!cfg.openaiApiKey) throw new Error("先に設定で OpenAI API キーを保存してください");
  return runPipeline({
    sourceFile,
    outputRoot: cfg.outputRoot,
    apiKey: cfg.openaiApiKey,
    longSilenceSec: cfg.longSilenceSec,
    keepSilenceSec: cfg.keepSilenceSec,
    silenceDb: cfg.silenceDb,
    titleMaxChars: cfg.titleMaxChars,
    onProgress: sendProgress,
  });
});

ipcMain.handle("project:list", async (_e, projectDir) => listActiveForUi(projectDir));

ipcMain.handle("project:updateTitle", async (_e, { projectDir, segmentId, title }) => {
  updateTitle(projectDir, segmentId, title);
  return listActiveForUi(projectDir);
});

ipcMain.handle("project:delete", async (_e, { projectDir, segmentId }) => {
  deleteSegment(projectDir, segmentId);
  return listActiveForUi(projectDir);
});

ipcMain.handle("project:merge", async (_e, { projectDir, leftId, rightId }) => {
  const cfg = loadConfig(userDataDir());
  await mergeSegments(projectDir, leftId, rightId, {
    padMs: cfg.mergePadMs,
    titleMaxChars: cfg.titleMaxChars,
  });
  return listActiveForUi(projectDir);
});

ipcMain.handle("project:reveal", async (_e, projectDir) => {
  if (projectDir && fs.existsSync(projectDir)) shell.openPath(projectDir);
});

ipcMain.handle("project:readMeta", async (_e, projectDir) => readMeta(projectDir));
