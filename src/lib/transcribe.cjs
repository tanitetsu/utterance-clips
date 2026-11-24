const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { exportMp3ForApi, sliceWav, probeDurationSec } = require("./ffmpeg.cjs");

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const CHUNK_SEC = 10 * 60;

function createClient(apiKey) {
  if (!apiKey) throw new Error("OpenAI API キーが設定されていません");
  return new OpenAI({ apiKey });
}

/**
 * Transcribe with utterance-level segments.
 * Uses whisper-1 + verbose_json for stable segment timestamps (design §4).
 * Large files are chunked under the 25MB upload limit.
 */
async function transcribeWav(client, wavPath, workDir, onProgress) {
  const mp3Path = path.join(workDir, "for-api.mp3");
  if (onProgress) onProgress({ stage: "compress", message: "API送信用に圧縮しています…" });
  await exportMp3ForApi(wavPath, mp3Path, { bitrate: "48k" });

  const size = fs.statSync(mp3Path).size;
  if (size <= MAX_UPLOAD_BYTES) {
    if (onProgress) onProgress({ stage: "transcribe", message: "文字起こし中…" });
    return transcribeFile(client, mp3Path);
  }

  const duration = await probeDurationSec(wavPath);
  const chunks = [];
  for (let start = 0; start < duration; start += CHUNK_SEC) {
    const end = Math.min(duration, start + CHUNK_SEC);
    const chunkWav = path.join(workDir, `chunk-${String(start).padStart(5, "0")}.wav`);
    const chunkMp3 = path.join(workDir, `chunk-${String(start).padStart(5, "0")}.mp3`);
    await sliceWav(wavPath, chunkWav, start, end);
    await exportMp3ForApi(chunkWav, chunkMp3, { bitrate: "48k" });
    chunks.push({ start, file: chunkMp3 });
  }

  const all = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress({
        stage: "transcribe",
        message: `文字起こし中… (${i + 1}/${chunks.length})`,
        ratio: i / chunks.length,
      });
    }
    const part = await transcribeFile(client, chunks[i].file);
    for (const seg of part.segments) {
      all.push({
        ...seg,
        start: seg.start + chunks[i].start,
        end: seg.end + chunks[i].start,
      });
    }
  }

  return {
    text: all.map((s) => s.text).join(""),
    segments: all,
  };
}

async function transcribeFile(client, filePath) {
  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    language: "ja",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments = (response.segments || []).map((s) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  })).filter((s) => s.text && s.end > s.start);

  return {
    text: String(response.text || ""),
    segments,
  };
}

module.exports = {
  createClient,
  transcribeWav,
};
