const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let ffmpegPath;
try {
  ffmpegPath = require("ffmpeg-static");
} catch {
  ffmpegPath = "ffmpeg";
}

function runFfmpeg(args, { onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (buf) => {
      const text = buf.toString();
      stderr += text;
      if (onStderr) onStderr(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}

async function convertToWav(inputPath, outputPath) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
  return outputPath;
}

/**
 * Collapse long silences while keeping a short pad (utterance boundary cue).
 * short pauses below longSilenceSec are left intact by stop_duration.
 */
async function collapseLongSilence(inputWav, outputWav, {
  longSilenceSec = 0.8,
  keepSilenceSec = 0.18,
  silenceDb = -40,
} = {}) {
  const filter = [
    `silenceremove=start_periods=0:start_silence=0`,
    `stop_periods=-1`,
    `stop_duration=${longSilenceSec}`,
    `stop_threshold=${silenceDb}dB`,
    `stop_silence=${keepSilenceSec}`,
  ].join(":");

  await runFfmpeg([
    "-y",
    "-i",
    inputWav,
    "-af",
    filter,
    "-c:a",
    "pcm_s16le",
    outputWav,
  ]);
  return outputWav;
}

async function exportMp3ForApi(inputWav, outputMp3, { bitrate = "48k" } = {}) {
  await runFfmpeg([
    "-y",
    "-i",
    inputWav,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    bitrate,
    outputMp3,
  ]);
  return outputMp3;
}

async function sliceWav(inputWav, outputWav, startSec, endSec) {
  const duration = Math.max(0.05, endSec - startSec);
  await runFfmpeg([
    "-y",
    "-ss",
    String(startSec),
    "-i",
    inputWav,
    "-t",
    String(duration),
    "-c:a",
    "pcm_s16le",
    outputWav,
  ]);
  return outputWav;
}

async function concatWavs(inputPaths, outputWav, { padMs = 0, sampleRate = 16000 } = {}) {
  if (inputPaths.length === 0) throw new Error("concat: no inputs");
  if (inputPaths.length === 1 && padMs <= 0) {
    fs.copyFileSync(inputPaths[0], outputWav);
    return outputWav;
  }

  const dir = path.dirname(outputWav);
  const listFile = path.join(dir, `_concat_${Date.now()}.txt`);
  const padFile = path.join(dir, `_pad_${Date.now()}.wav`);
  const lines = [];

  try {
    if (padMs > 0) {
      await runFfmpeg([
        "-y",
        "-f",
        "lavfi",
        "-i",
        `anullsrc=r=${sampleRate}:cl=mono`,
        "-t",
        String(padMs / 1000),
        "-c:a",
        "pcm_s16le",
        padFile,
      ]);
    }

    inputPaths.forEach((p, i) => {
      lines.push(`file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
      if (padMs > 0 && i < inputPaths.length - 1) {
        lines.push(`file '${padFile.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
      }
    });
    fs.writeFileSync(listFile, lines.join("\n"), "utf8");

    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c:a",
      "pcm_s16le",
      outputWav,
    ]);
  } finally {
    for (const f of [listFile, padFile]) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
  return outputWav;
}

async function probeDurationSec(inputPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = ffmpegPath.includes("ffmpeg")
      ? ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1")
      : "ffprobe";
    const child = spawn(
      fs.existsSync(ffprobe) ? ffprobe : "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath],
      { windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => {
      out += b.toString();
    });
    child.stderr.on("data", (b) => {
      err += b.toString();
    });
    child.on("error", () => {
      // fallback via ffmpeg -i
      runFfmpeg(["-i", inputPath])
        .then(() => resolve(0))
        .catch((e) => {
          const m = String(e.message).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (!m) return reject(e);
          resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
        });
    });
    child.on("close", (code) => {
      if (code === 0) {
        const n = Number.parseFloat(out.trim());
        if (!Number.isNaN(n)) return resolve(n);
      }
      runFfmpeg(["-i", inputPath])
        .then(() => resolve(0))
        .catch((e) => {
          const m = String(e.message).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (!m) return reject(new Error(err || e.message));
          resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
        });
    });
  });
}

module.exports = {
  ffmpegPath,
  runFfmpeg,
  convertToWav,
  collapseLongSilence,
  exportMp3ForApi,
  sliceWav,
  concatWavs,
  probeDurationSec,
};
