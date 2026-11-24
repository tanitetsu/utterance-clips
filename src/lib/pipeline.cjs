const fs = require("fs");
const path = require("path");
const { ensureDir, makeProjectDir } = require("./paths.cjs");
const { emptyMeta, writeMeta, makeTitle } = require("./meta.cjs");
const {
  convertToWav,
  collapseLongSilence,
  sliceWav,
} = require("./ffmpeg.cjs");
const { createClient, transcribeWav } = require("./transcribe.cjs");

async function runPipeline({
  sourceFile,
  outputRoot,
  apiKey,
  longSilenceSec,
  keepSilenceSec,
  silenceDb,
  titleMaxChars,
  onProgress,
}) {
  if (!sourceFile || !fs.existsSync(sourceFile)) {
    throw new Error("音声ファイルが見つかりません");
  }
  ensureDir(outputRoot);
  const projectDir = makeProjectDir(outputRoot, sourceFile);
  const workDir = ensureDir(path.join(projectDir, "_work"));
  const audioDir = ensureDir(path.join(projectDir, "audio"));

  const report = (payload) => {
    if (onProgress) onProgress(payload);
  };

  report({ stage: "convert", message: "音声を変換しています…", ratio: 0.05 });
  const rawWav = path.join(workDir, "raw.wav");
  await convertToWav(sourceFile, rawWav);

  report({ stage: "silence", message: "長い無音を短縮しています…", ratio: 0.15 });
  const cleanedWav = path.join(workDir, "cleaned.wav");
  await collapseLongSilence(rawWav, cleanedWav, {
    longSilenceSec,
    keepSilenceSec,
    silenceDb,
  });

  // Keep a copy of the cleaned master for reference
  const masterCopy = path.join(projectDir, "cleaned-master.wav");
  fs.copyFileSync(cleanedWav, masterCopy);

  const client = createClient(apiKey);
  const transcript = await transcribeWav(client, cleanedWav, workDir, (p) => {
    report({
      stage: p.stage || "transcribe",
      message: p.message || "文字起こし中…",
      ratio: 0.25 + (p.ratio || 0) * 0.45,
    });
  });

  if (!transcript.segments.length) {
    throw new Error("発話セグメントが得られませんでした。別の音声で試すか、無音閾値を緩めてください。");
  }

  const meta = emptyMeta({ sourceFile, projectDir });
  const total = transcript.segments.length;

  for (let i = 0; i < total; i++) {
    const seg = transcript.segments[i];
    const id = String(i + 1).padStart(3, "0");
    const rel = `audio/${id}.wav`;
    const abs = path.join(projectDir, rel);
    report({
      stage: "split",
      message: `発話を切り出し中… (${i + 1}/${total})`,
      ratio: 0.7 + (i / total) * 0.25,
    });
    await sliceWav(cleanedWav, abs, seg.start, seg.end);
    meta.segments.push({
      id,
      file: rel,
      title: makeTitle(seg.text, titleMaxChars),
      text: seg.text,
      status: "active",
      start: seg.start,
      end: seg.end,
    });
  }

  writeMeta(projectDir, meta);
  report({ stage: "done", message: "完了しました", ratio: 1, projectDir });

  // Cleanup large work intermediates but keep cleaned master
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { projectDir, meta };
}

module.exports = { runPipeline };
