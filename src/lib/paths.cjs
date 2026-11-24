const fs = require("fs");
const path = require("path");
const os = require("os");

function getUserDataDir(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("userData");
  }
  return path.join(os.homedir(), ".utterance-clips");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function configPath(userDataDir) {
  return path.join(userDataDir, "config.json");
}

function defaultOutputRoot(userDataDir) {
  return path.join(userDataDir, "projects");
}

function makeProjectDir(outputRoot, sourceFile) {
  const base = path.basename(sourceFile, path.extname(sourceFile)).replace(/[^\w\-一-龥ぁ-んァ-ヶ]+/g, "_").slice(0, 40) || "meeting";
  const stamp = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const name = `${base}-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
  return ensureDir(path.join(outputRoot, name));
}

module.exports = {
  getUserDataDir,
  ensureDir,
  configPath,
  defaultOutputRoot,
  makeProjectDir,
};
