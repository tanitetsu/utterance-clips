const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { emptyMeta, writeMeta, readMeta, makeTitle, nextSegmentId, activeSegments } = require("../src/lib/meta.cjs");

test("makeTitle truncates", () => {
  assert.equal(makeTitle("短い"), "短い");
  assert.equal(makeTitle("あ".repeat(30), 10), `${"あ".repeat(10)}…`);
});

test("meta roundtrip and next id", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uc-meta-"));
  const meta = emptyMeta({ sourceFile: "a.wav", projectDir: dir });
  meta.segments.push({ id: "001", file: "audio/001.wav", title: "t", text: "t", status: "active" });
  meta.segments.push({ id: "002", file: "audio/002.wav", title: "u", text: "u", status: "deleted" });
  writeMeta(dir, meta);
  const loaded = readMeta(dir);
  assert.equal(activeSegments(loaded).length, 1);
  assert.equal(nextSegmentId(loaded), "003");
});
