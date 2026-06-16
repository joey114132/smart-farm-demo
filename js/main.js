import { FarmScene3D } from "./scene3d.js";
import { Map2D } from "./map2d.js";
import { JETCOBOT_STATIONS } from "./layout.js";

const state = {
  pinkyT: 0,
  harvestPhase: 0,
  conveyorT: 0,
  activeStation: "A",
  paused: false,
  speed: 1,
};

let stationIdx = 0;
let scene3d;
let map2d;

function cycleStation() {
  stationIdx = (stationIdx + 1) % JETCOBOT_STATIONS.length;
  state.activeStation = JETCOBOT_STATIONS[stationIdx].id;
}

function tick(dt) {
  if (state.paused) return;
  const rate = 0.08 * state.speed;
  state.harvestPhase += dt * rate;
  state.pinkyT += dt * 0.06 * state.speed;
  state.conveyorT += dt * 0.05 * state.speed;

  if (state.harvestPhase >= 1) {
    state.harvestPhase = 0;
    cycleStation();
  }
}

function loop() {
  tick(1 / 60);
  scene3d?.render();
  map2d?.draw();
  requestAnimationFrame(loop);
}

function wireControls() {
  const pauseBtn = document.getElementById("btn-pause");
  const speed = document.getElementById("speed");
  const speedVal = document.getElementById("speed-val");

  pauseBtn?.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  });

  speed?.addEventListener("input", () => {
    state.speed = Number(speed.value);
    if (speedVal) speedVal.textContent = `${state.speed.toFixed(1)}×`;
  });
}

function setBootStatus(msg, isError = false) {
  const el = document.getElementById("load-status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#ff8a80" : "";
}

function init() {
  const mount3d = document.getElementById("view-3d");
  const canvas2d = document.getElementById("view-2d");
  if (!mount3d || !canvas2d) {
    setBootStatus("Missing view containers", true);
    return;
  }

  setBootStatus("Building scene…");
  scene3d = new FarmScene3D(mount3d, state);
  map2d = new Map2D(canvas2d, state);
  wireControls();

  // flex 레이아웃 확정 후 캔버스/렌더러 크기 재계산
  requestAnimationFrame(() => {
    map2d.resize();
    scene3d.onResize();
    map2d.draw();
    scene3d.render();
    requestAnimationFrame(loop);
  });
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
} catch (err) {
  console.error(err);
  setBootStatus(`Boot error: ${err.message}`, true);
}
