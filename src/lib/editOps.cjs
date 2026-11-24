const fs = require("fs");
const path = require("path");
const {
  readMeta,
  writeMeta,
  activeSegments,
  nextSegmentId,
  makeTitle,
} = require("./meta.cjs");
const { concatWavs } = require("./ffmpeg.cjs");
const { ensureDir } = require("./paths.cjs");

function archiveFile(projectDir, relFile) {
  const src = path.join(projectDir, relFile);
  if (!fs.existsSync(src)) return null;
  const archivedDir = ensureDir(path.join(projectDir, "audio", "_archived"));
  const dest = path.join(archivedDir, path.basename(relFile));
  let finalDest = dest;
  let i = 1;
  while (fs.existsSync(finalDest)) {
    const ext = path.extname(dest);
    const stem = path.basename(dest, ext);
    finalDest = path.join(archivedDir, `${stem}_${i}${ext}`);
    i += 1;
  }
  fs.renameSync(src, finalDest);
  return path.relative(projectDir, finalDest).replace(/\\/g, "/");
}

function updateTitle(projectDir, segmentId, title) {
  const meta = readMeta(projectDir);
  const seg = meta.segments.find((s) => s.id === segmentId && s.status === "active");
  if (!seg) throw new Error(`セグメントが見つかりません: ${segmentId}`);
  seg.title = String(title || "").trim() || makeTitle(seg.text);
  writeMeta(projectDir, meta);
  return meta;
}

function deleteSegment(projectDir, segmentId) {
  const meta = readMeta(projectDir);
  const seg = meta.segments.find((s) => s.id === segmentId && s.status === "active");
  if (!seg) throw new Error(`セグメントが見つかりません: ${segmentId}`);
  seg.status = "deleted";
  if (seg.file) {
    const archived = archiveFile(projectDir, seg.file);
    if (archived) seg.archivedFile = archived;
  }
  writeMeta(projectDir, meta);
  return meta;
}

/**
 * Merge two adjacent active segments into a NEW audio file.
 * Originals are archived; never overwritten (design §6.4).
 */
async function mergeSegments(projectDir, leftId, rightId, { padMs = 200, titleMaxChars = 24 } = {}) {
  const meta = readMeta(projectDir);
  const actives = activeSegments(meta);
  const leftIndex = actives.findIndex((s) => s.id === leftId);
  if (leftIndex < 0) throw new Error(`左セグメントが見つかりません: ${leftId}`);
  const left = actives[leftIndex];
  const right = actives[leftIndex + 1];
  if (!right || right.id !== rightId) {
    throw new Error("結合は隣り合う2つの文だけできます");
  }

  const newId = nextSegmentId(meta);
  const audioDir = ensureDir(path.join(projectDir, "audio"));
  const newRel = `audio/${newId}.wav`;
  const newAbs = path.join(projectDir, newRel);
  const leftAbs = path.join(projectDir, left.file);
  const rightAbs = path.join(projectDir, right.file);

  await concatWavs([leftAbs, rightAbs], newAbs, { padMs });

  const mergedText = `${left.text || ""} ${right.text || ""}`.replace(/\s+/g, " ").trim();
  const newSeg = {
    id: newId,
    file: newRel,
    title: makeTitle(mergedText, titleMaxChars),
    text: mergedText,
    status: "active",
    mergedFrom: [left.id, right.id],
  };

  // Snapshot for rollback
  const leftStatus = left.status;
  const rightStatus = right.status;
  const leftFile = left.file;
  const rightFile = right.file;

  try {
    left.status = "merged";
    right.status = "merged";
    const archivedLeft = archiveFile(projectDir, leftFile);
    const archivedRight = archiveFile(projectDir, rightFile);
    if (archivedLeft) left.archivedFile = archivedLeft;
    if (archivedRight) right.archivedFile = archivedRight;

    const insertAt = meta.segments.findIndex((s) => s.id === left.id);
    meta.segments.splice(insertAt + 1, 0, newSeg);
    // Keep history but viewer uses active only; move newSeg to replace visual order:
    // Ensure newSeg appears where left was among actives by placing it right after left entry.
    writeMeta(projectDir, meta);
  } catch (err) {
    try {
      if (fs.existsSync(newAbs)) fs.unlinkSync(newAbs);
    } catch {
      /* ignore */
    }
    left.status = leftStatus;
    right.status = rightStatus;
    throw err;
  }

  return meta;
}

function listActiveForUi(projectDir) {
  const meta = readMeta(projectDir);
  return {
    meta: { ...meta, projectDir },
    segments: activeSegments(meta).map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      file: s.file,
      absFile: path.join(projectDir, s.file),
    })),
  };
}

module.exports = {
  updateTitle,
  deleteSegment,
  mergeSegments,
  listActiveForUi,
};
