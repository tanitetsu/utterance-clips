const fs = require("fs");
const path = require("path");

function emptyMeta({ sourceFile, projectDir }) {
  return {
    version: 1,
    sourceFile: path.basename(sourceFile),
    projectDir,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    segments: [],
  };
}

function readMeta(projectDir) {
  const file = path.join(projectDir, "meta.json");
  if (!fs.existsSync(file)) {
    throw new Error(`meta.json がありません: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeMeta(projectDir, meta) {
  meta.updatedAt = new Date().toISOString();
  const file = path.join(projectDir, "meta.json");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return meta;
}

function activeSegments(meta) {
  return (meta.segments || []).filter((s) => s.status === "active");
}

function nextSegmentId(meta) {
  let max = 0;
  for (const s of meta.segments || []) {
    const n = Number.parseInt(String(s.id).replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return String(max + 1).padStart(3, "0");
}

function makeTitle(text, maxChars = 24) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) return "(無音)";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}…`;
}

module.exports = {
  emptyMeta,
  readMeta,
  writeMeta,
  activeSegments,
  nextSegmentId,
  makeTitle,
};
