const state = {
  sourceFile: null,
  lastProjectDir: null,
  projectDir: null,
  segments: [],
  index: 0,
  offProgress: null,
};

const $ = (id) => document.getElementById(id);

function showTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${name}`);
  });
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

async function loadSettings() {
  const cfg = await window.api.getConfig();
  $("cfg-api-key").value = cfg.openaiApiKey || "";
  $("cfg-output-root").value = cfg.outputRoot || "";
  $("cfg-long-silence").value = cfg.longSilenceSec;
  $("cfg-keep-silence").value = cfg.keepSilenceSec;
  $("cfg-silence-db").value = cfg.silenceDb;
  $("cfg-merge-pad").value = cfg.mergePadMs;
}

$("btn-save-config").addEventListener("click", async () => {
  try {
    await window.api.saveConfig({
      openaiApiKey: $("cfg-api-key").value.trim(),
      outputRoot: $("cfg-output-root").value.trim(),
      longSilenceSec: Number($("cfg-long-silence").value),
      keepSilenceSec: Number($("cfg-keep-silence").value),
      silenceDb: Number($("cfg-silence-db").value),
      mergePadMs: Number($("cfg-merge-pad").value),
    });
    $("cfg-status").textContent = "保存しました";
  } catch (err) {
    $("cfg-status").textContent = err.message || String(err);
  }
});

$("btn-pick-audio").addEventListener("click", async () => {
  const file = await window.api.openAudio();
  if (!file) return;
  state.sourceFile = file;
  $("picked-audio").textContent = file;
  $("btn-run").disabled = false;
});

$("btn-run").addEventListener("click", async () => {
  if (!state.sourceFile) return;
  $("btn-run").disabled = true;
  $("progress-bar").style.width = "0%";
  $("progress-text").textContent = "開始…";
  if (state.offProgress) state.offProgress();
  state.offProgress = window.api.onPipelineProgress((p) => {
    const pct = Math.round((p.ratio || 0) * 100);
    $("progress-bar").style.width = `${pct}%`;
    $("progress-text").textContent = p.message || p.stage || "";
  });
  try {
    const result = await window.api.runPipeline(state.sourceFile);
    state.lastProjectDir = result.projectDir;
    $("btn-open-result").disabled = false;
    $("progress-text").textContent = `完了: ${result.projectDir}`;
    await openProjectDir(result.projectDir);
    showTab("viewer");
  } catch (err) {
    $("progress-text").textContent = err.message || String(err);
  } finally {
    $("btn-run").disabled = false;
    if (state.offProgress) {
      state.offProgress();
      state.offProgress = null;
    }
  }
});

$("btn-open-result").addEventListener("click", async () => {
  if (state.lastProjectDir) await window.api.revealProject(state.lastProjectDir);
});

async function applyProjectPayload(payload) {
  state.projectDir = payload.meta.projectDir || state.projectDir;
  state.segments = payload.segments || [];
  if (state.index >= state.segments.length) state.index = Math.max(0, state.segments.length - 1);
  $("project-path").textContent = state.projectDir || "";
  renderList();
  selectIndex(state.index);
}

async function openProjectDir(dir) {
  const payload = await window.api.listProject(dir);
  state.projectDir = dir;
  await applyProjectPayload(payload);
}

$("btn-open-project").addEventListener("click", async () => {
  try {
    const payload = await window.api.openProject();
    if (!payload) return;
    state.projectDir = payload.meta.projectDir;
    state.index = 0;
    await applyProjectPayload(payload);
  } catch (err) {
    $("viewer-status").textContent = err.message || String(err);
  }
});

function renderList() {
  const ul = $("segment-list");
  ul.innerHTML = "";
  state.segments.forEach((seg, i) => {
    const li = document.createElement("li");
    li.className = i === state.index ? "active" : "";
    li.innerHTML = `<span class="id">${seg.id}</span> <span class="title"></span>`;
    li.querySelector(".title").textContent = seg.title || "(無題)";
    li.addEventListener("click", () => selectIndex(i, true));
    ul.appendChild(li);
  });
}

function selectIndex(i, autoplay = false) {
  if (!state.segments.length) {
    $("title-input").value = "";
    $("title-input").disabled = true;
    $("text-view").value = "";
    $("player").removeAttribute("src");
    ["btn-prev", "btn-play", "btn-next", "btn-save-title", "btn-delete", "btn-merge"].forEach(
      (id) => ($(id).disabled = true),
    );
    $("viewer-status").textContent = "表示できる文がありません";
    renderList();
    return;
  }
  state.index = Math.max(0, Math.min(i, state.segments.length - 1));
  const seg = state.segments[state.index];
  $("title-input").disabled = false;
  $("title-input").value = seg.title || "";
  $("text-view").value = seg.text || "";
  $("player").src = pathToFileUrl(seg.absFile);
  $("btn-prev").disabled = state.index <= 0;
  $("btn-next").disabled = state.index >= state.segments.length - 1;
  $("btn-play").disabled = false;
  $("btn-save-title").disabled = false;
  $("btn-delete").disabled = false;
  $("btn-merge").disabled = state.index >= state.segments.length - 1;
  $("viewer-status").textContent = `${state.index + 1} / ${state.segments.length}`;
  renderList();
  if (autoplay) playCurrent();
}

function pathToFileUrl(absPath) {
  const normalized = String(absPath).replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

function playCurrent() {
  const player = $("player");
  player.currentTime = 0;
  player.play().catch(() => {});
}

$("btn-play").addEventListener("click", () => playCurrent());
$("btn-prev").addEventListener("click", () => selectIndex(state.index - 1, true));
$("btn-next").addEventListener("click", () => selectIndex(state.index + 1, true));

window.addEventListener("keydown", (e) => {
  if (!$("panel-viewer").classList.contains("active")) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectIndex(state.index - 1, true);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    selectIndex(state.index + 1, true);
  } else if (e.key === " ") {
    e.preventDefault();
    const player = $("player");
    if (player.paused) playCurrent();
    else player.pause();
  }
});

$("btn-save-title").addEventListener("click", async () => {
  const seg = state.segments[state.index];
  if (!seg) return;
  try {
    const payload = await window.api.updateTitle(state.projectDir, seg.id, $("title-input").value);
    await applyProjectPayload(payload);
    $("viewer-status").textContent = "タイトルを保存しました";
  } catch (err) {
    $("viewer-status").textContent = err.message || String(err);
  }
});

$("btn-delete").addEventListener("click", async () => {
  const seg = state.segments[state.index];
  if (!seg) return;
  if (!confirm(`「${seg.title}」を削除しますか？\n音声は _archived に移します。`)) return;
  try {
    const payload = await window.api.deleteSegment(state.projectDir, seg.id);
    await applyProjectPayload(payload);
  } catch (err) {
    $("viewer-status").textContent = err.message || String(err);
  }
});

$("btn-merge").addEventListener("click", async () => {
  const left = state.segments[state.index];
  const right = state.segments[state.index + 1];
  if (!left || !right) return;
  if (!confirm(`「${left.title}」と「${right.title}」を結合します。\n新規ファイルを作成し、元ファイルはアーカイブします。`)) {
    return;
  }
  try {
    $("viewer-status").textContent = "結合中…";
    const payload = await window.api.mergeSegments(state.projectDir, left.id, right.id);
    await applyProjectPayload(payload);
    $("viewer-status").textContent = "結合しました（新規ファイル）";
  } catch (err) {
    $("viewer-status").textContent = err.message || String(err);
  }
});

loadSettings().catch((err) => {
  $("cfg-status").textContent = err.message || String(err);
});
