const fs = require("fs");
const { configPath, ensureDir, defaultOutputRoot } = require("./paths.cjs");

const DEFAULTS = {
  openaiApiKey: "",
  outputRoot: "",
  longSilenceSec: 0.8,
  keepSilenceSec: 0.18,
  silenceDb: -40,
  titleMaxChars: 24,
  mergePadMs: 200,
};

function loadConfig(userDataDir) {
  ensureDir(userDataDir);
  const file = configPath(userDataDir);
  let stored = {};
  if (fs.existsSync(file)) {
    try {
      stored = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      stored = {};
    }
  }
  const merged = { ...DEFAULTS, ...stored };
  if (!merged.outputRoot) {
    merged.outputRoot = defaultOutputRoot(userDataDir);
  }
  if (!merged.openaiApiKey && process.env.OPENAI_API_KEY) {
    merged.openaiApiKey = process.env.OPENAI_API_KEY;
  }
  return merged;
}

function saveConfig(userDataDir, patch) {
  const current = loadConfig(userDataDir);
  const next = { ...current, ...patch };
  ensureDir(userDataDir);
  fs.writeFileSync(configPath(userDataDir), JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = { DEFAULTS, loadConfig, saveConfig };
