import {
  MAP,
  LOCALIZATION_ZONE,
  JETCOBOT_STATIONS,
  PINKY_ANCHORS,
  PINKY_INFLATION_CM,
  PINKY_JETCOBOT_AISLE_Y,
  TRAFFIC_LOOP_CM,
  FARM_BEDS,
  workCellRect,
  samplePolyline,
} from "./layout.js";

/** 2D top-down canvas mirroring the analysis diagram. */
export class Map2D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ pinkyT: number, harvestPhase: number, activeStation: string }} state
   */
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = state;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
    const pad = 28;
    const farmExtra = 42;
    this.scale = Math.min(
      (this.w - pad * 2) / MAP.widthCm,
      (this.h - pad * 2 - farmExtra) / (MAP.heightCm + farmExtra),
    );
    this.ox = (this.w - MAP.widthCm * this.scale) / 2;
    this.oy = this.h - pad - MAP.heightCm * this.scale;
  }

  /** Map cm (bottom-left origin) → canvas px. */
  toPx(xCm, yCm) {
    return {
      x: this.ox + xCm * this.scale,
      y: this.oy - yCm * this.scale,
    };
  }

  draw() {
    if (this.w < 2 || this.h < 2) this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = "#0b1210";
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawFarmBeds();
    this.drawMapBoundary();
    this.drawLocalizationZone();
    this.drawTrafficLoop();
    this.drawWorkCells();
    this.drawPinkyInflation();
    this.drawPinkies();
    this.drawLegend();
    this.drawPhaseLabel();
  }

  drawMapBoundary() {
    const p0 = this.toPx(0, 0);
    const p1 = this.toPx(MAP.widthCm, MAP.heightCm);
    this.ctx.strokeStyle = "#e8f0ea";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(p0.x, p1.y, p1.x - p0.x, p0.y - p1.y);
  }

  drawLocalizationZone() {
    const a = this.toPx(LOCALIZATION_ZONE.xMin, LOCALIZATION_ZONE.yMin);
    const b = this.toPx(LOCALIZATION_ZONE.xMax, LOCALIZATION_ZONE.yMax);
    this.ctx.fillStyle = "rgba(255, 182, 193, 0.18)";
    this.ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
  }

  drawFarmBeds() {
    for (const bed of FARM_BEDS) {
      const x0 = bed.xCenter - bed.widthCm / 2;
      const x1 = bed.xCenter + bed.widthCm / 2;
      const a = this.toPx(x0, bed.zMinCm);
      const b = this.toPx(x1, bed.zMaxCm);
      this.ctx.fillStyle = "rgba(34, 120, 52, 0.35)";
      this.ctx.strokeStyle = "#3d9b55";
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      this.ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);

      const plantR = Math.max(2, this.scale * 1.2);
      for (let r = 0; r < bed.rows; r++) {
        for (let c = 0; c < bed.plantsPerRow; c++) {
          const px = x0 + ((c + 0.5) / bed.plantsPerRow) * bed.widthCm;
          const py = bed.zMinCm + ((r + 0.5) / bed.rows) * (bed.zMaxCm - bed.zMinCm);
          const p = this.toPx(px, py);
          const ripe = (r + c + (this.state.harvestPhase > 0.5 ? 1 : 0)) % 3 !== 0;
          this.ctx.fillStyle = ripe ? "#c62828" : "#2e7d32";
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, plantR, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
    this.ctx.fillStyle = "#9ad4a8";
    this.ctx.font = "11px system-ui,sans-serif";
    const label = this.toPx(MAP.widthCm / 2, MAP.heightCm + 38);
    this.ctx.textAlign = "center";
    this.ctx.fillText("Tomato beds (outside frame, JetCobot reach)", label.x, label.y);
  }

  drawWorkCells() {
    for (const st of JETCOBOT_STATIONS) {
      const r = workCellRect(st);
      const a = this.toPx(r.xMin, r.yMin);
      const b = this.toPx(r.xMax, r.yMax);
      this.ctx.fillStyle = "rgba(66, 133, 244, 0.22)";
      this.ctx.strokeStyle = "#4285f4";
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      this.ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
      const c = this.toPx(st.x, st.y);
      this.ctx.fillStyle = "#b3d4ff";
      this.ctx.font = "bold 11px system-ui,sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(st.label, c.x, c.y + 4);
    }

    // Pinky aisle — JetCobot 작업셀 바로 아래 통로
    const aisleL = this.toPx(15, PINKY_JETCOBOT_AISLE_Y);
    const aisleR = this.toPx(85, PINKY_JETCOBOT_AISLE_Y);
    this.ctx.strokeStyle = "rgba(233, 30, 140, 0.45)";
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([4, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(aisleL.x, aisleL.y);
    this.ctx.lineTo(aisleR.x, aisleR.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "#e91e8c";
    this.ctx.font = "9px system-ui,sans-serif";
    this.ctx.textAlign = "center";
    const mid = this.toPx(50, PINKY_JETCOBOT_AISLE_Y - 6);
    this.ctx.fillText("Pinky Pro aisle", mid.x, mid.y);
  }

  drawTrafficLoop() {
    const ctx = this.ctx;
    ctx.strokeStyle = "#43a047";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const start = this.toPx(TRAFFIC_LOOP_CM[0].x, TRAFFIC_LOOP_CM[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < TRAFFIC_LOOP_CM.length; i++) {
      const p = this.toPx(TRAFFIC_LOOP_CM[i].x, TRAFFIC_LOOP_CM[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < TRAFFIC_LOOP_CM.length - 1; i++) {
      const a = TRAFFIC_LOOP_CM[i];
      const b = TRAFFIC_LOOP_CM[i + 1];
      const mid = this.toPx((a.x + b.x) / 2, (a.y + b.y) / 2);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.drawArrow(mid.x, mid.y, ang, 7);
    }
  }

  drawArrow(x, y, ang, len) {
    this.ctx.fillStyle = "#66bb6a";
    this.ctx.beginPath();
    this.ctx.moveTo(x + Math.cos(ang) * len, y - Math.sin(ang) * len);
    this.ctx.lineTo(x + Math.cos(ang + 2.6) * len * 0.6, y - Math.sin(ang + 2.6) * len * 0.6);
    this.ctx.lineTo(x + Math.cos(ang - 2.6) * len * 0.6, y - Math.sin(ang - 2.6) * len * 0.6);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawPinkyInflation() {
    for (const anchor of PINKY_ANCHORS) {
      const p = this.toPx(anchor.x, anchor.y);
      const r = PINKY_INFLATION_CM * this.scale;
      const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, "rgba(186, 104, 200, 0.35)");
      g.addColorStop(1, "rgba(186, 104, 200, 0.05)");
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawPinkies() {
    const offsets = [0, 0.33, 0.66];
    const ids = ["P1", "P2", "P3"];
    offsets.forEach((off, i) => {
      const pos = samplePolyline(TRAFFIC_LOOP_CM, this.state.pinkyT + off);
      const p = this.toPx(pos.x, pos.y);
      this.ctx.fillStyle = "#e91e8c";
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(4, this.scale * 2.2), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#ffcce8";
      this.ctx.font = "10px system-ui,sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(ids[i], p.x, p.y - 8);
    });
  }

  drawLegend() {
    const items = [
      ["#e8f0ea", "Map boundary"],
      ["#ffb6c1", "Reliable localization"],
      ["#4285f4", "JetCobot work cell"],
      ["#43a047", "Clockwise traffic loop"],
      ["#e91e8c", "Pinky Pro"],
      ["#c62828", "Ripe tomato"],
    ];
    let y = 14;
    this.ctx.font = "10px system-ui,sans-serif";
    this.ctx.textAlign = "left";
    for (const [color, label] of items) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(10, y - 8, 10, 10);
      this.ctx.fillStyle = "#c5d6c8";
      this.ctx.fillText(label, 24, y);
      y += 14;
    }
  }

  drawPhaseLabel() {
    const phases = [
      "Idle — arms home",
      "Harvest — reach north beds",
      "Sort — drop into crate at cell",
      "Transport — Pinky Pro clockwise loop",
    ];
    const idx = Math.min(phases.length - 1, Math.floor(this.state.harvestPhase * phases.length));
    this.ctx.fillStyle = "#dfffe8";
    this.ctx.font = "12px system-ui,sans-serif";
    this.ctx.textAlign = "right";
    this.ctx.fillText(phases[idx], this.w - 12, this.h - 12);
    this.ctx.fillStyle = "#8ab89a";
    this.ctx.font = "10px system-ui,sans-serif";
    this.ctx.fillText(`Active station: JetCobot ${this.state.activeStation}`, this.w - 12, this.h - 28);
  }
}
