import {
  MAP,
  MAP_EXTENTS,
  LOCALIZATION_ZONE,
  JETCOBOT_STATIONS,
  PINKY_ANCHORS,
  PINKY_INFLATION_CM,
  PINKY_JETCOBOT_AISLE_Y,
  CONVEYOR_GRADE_LINE,
  NUTRIENT_AREA,
  TRAFFIC_LOOP_CM,
  CONVEYOR_SPUR_CM,
  PINKY_FLEET,
  pinkyPathForRole,
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
    const totalW = MAP_EXTENTS.xMax - MAP_EXTENTS.xMin;
    const totalH = MAP_EXTENTS.yMax - MAP_EXTENTS.yMin;
    this.scale = Math.min(
      (this.w - pad * 2) / totalW,
      (this.h - pad * 2) / totalH,
    );
    const drawW = totalW * this.scale;
    const drawH = totalH * this.scale;
    this.ox = (this.w - drawW) / 2 - MAP_EXTENTS.xMin * this.scale;
    this.centerYCm = (MAP_EXTENTS.yMax + MAP_EXTENTS.yMin) / 2;
    this.cy = this.h / 2;
  }

  /** Map cm → canvas px (X mirrored to match default 3D camera). */
  toPx(xCm, yCm) {
    const xMirror = MAP.widthCm - xCm;
    return {
      x: this.ox + xMirror * this.scale,
      y: this.cy + (this.centerYCm - yCm) * this.scale,
    };
  }

  /** 화면상 화살표 각도 — 미러링 후 실제 픽셀 방향 */
  edgeArrowAngle(a, b) {
    const pa = this.toPx(a.x, a.y);
    const pb = this.toPx(b.x, b.y);
    return Math.atan2(pb.y - pa.y, pb.x - pa.x);
  }

  draw() {
    if (this.w < 2 || this.h < 2) this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = "#0b1210";
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawFarmBeds();
    this.drawConveyor();
    this.drawNutrientArea();
    this.drawMapBoundary();
    this.drawLocalizationZone();
    this.drawTrafficLoop();
    this.drawConveyorSpur();
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
    this.ctx.fillStyle = "#9ad4a8";
    this.ctx.font = "10px system-ui,sans-serif";
    this.ctx.textAlign = "center";
    const tag = this.toPx(MAP.widthCm / 2, MAP.heightCm * 0.5);
    this.ctx.fillText("STADIUM (100×200 cm)", tag.x, tag.y);
  }

  drawConveyor() {
    const c = CONVEYOR_GRADE_LINE;
    const a = this.toPx(c.xMin, c.yCenter + c.widthCm / 2);
    const b = this.toPx(c.xMax, c.yCenter - c.widthCm / 2);
    this.ctx.fillStyle = "rgba(120, 120, 128, 0.55)";
    this.ctx.strokeStyle = "#ffc107";
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
    this.ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);

    // 벨트 위 토마토 (등급 판별 시뮬)
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = (this.state.conveyorT + i / n) % 1;
      const x = c.xMin + t * (c.xMax - c.xMin);
      const p = this.toPx(x, c.yCenter);
      const grade =
        x < 40 ? "#c62828" : x < 62 ? "#ef6c00" : x < 74 ? "#2e7d32" : "#616161";
      this.ctx.fillStyle = grade;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(3, this.scale * 1.1), 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (const st of c.stations) {
      const p = this.toPx(st.x, st.y);
      this.ctx.fillStyle = "#ffe082";
      this.ctx.font = "9px system-ui,sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(st.label, p.x, p.y - 8);
    }

    const gate = this.toPx(50, c.gateY);
    this.ctx.strokeStyle = "rgba(255, 193, 7, 0.8)";
    this.ctx.setLineDash([3, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.toPx(0, 0).x, gate.y);
    this.ctx.lineTo(this.toPx(MAP.widthCm, 0).x, gate.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "#ffc107";
    this.ctx.font="9px system-ui,sans-serif";
    this.ctx.fillText("남쪽 게이트 → 컨베이어", gate.x, gate.y + 12);
  }

  drawNutrientArea() {
    const n = NUTRIENT_AREA;
    const a = this.toPx(n.xMin, n.yMin);
    const b = this.toPx(n.xMax, n.yMax);
    const w = b.x - a.x;
    const h = a.y - b.y;
    // 스트라이프 패턴 — 고정 탱크 존
    this.ctx.fillStyle = "rgba(255, 235, 59, 0.14)";
    this.ctx.fillRect(a.x, b.y, w, h);
    const stripeW = Math.max(4, this.scale * 2.5);
    for (let x = a.x; x < a.x + w; x += stripeW * 2) {
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      this.ctx.fillRect(x, b.y, stripeW, h);
    }
    this.ctx.strokeStyle = "rgba(255, 235, 59, 0.7)";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(a.x, b.y, w, h);
    const mid = this.toPx((n.xMin + n.xMax) / 2, (n.yMin + n.yMax) / 2);
    this.ctx.fillStyle = "#fff59d";
    this.ctx.font = "9px system-ui,sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText("양액 혼합·저장", mid.x, mid.y - 4);
    this.ctx.fillStyle = "#c5b358";
    this.ctx.font = "8px system-ui,sans-serif";
    this.ctx.fillText("남쪽 벽 고정 탱크 · Pinky 통과 불가", mid.x, mid.y + 8);
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
          this.ctx.fillStyle = "#c62828";
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

    const edges = [...TRAFFIC_LOOP_CM, TRAFFIC_LOOP_CM[0]];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i];
      const b = edges[i + 1];
      const mid = this.toPx((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.drawArrow(mid.x, mid.y, this.edgeArrowAngle(a, b), 7);
    }
  }

  drawConveyorSpur() {
    const ctx = this.ctx;
    ctx.strokeStyle = "#ffc107";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    const start = this.toPx(CONVEYOR_SPUR_CM[0].x, CONVEYOR_SPUR_CM[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < CONVEYOR_SPUR_CM.length; i++) {
      const p = this.toPx(CONVEYOR_SPUR_CM[i].x, CONVEYOR_SPUR_CM[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < CONVEYOR_SPUR_CM.length - 1; i++) {
      const a = CONVEYOR_SPUR_CM[i];
      const b = CONVEYOR_SPUR_CM[i + 1];
      const mid = this.toPx((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.drawArrow(mid.x, mid.y, this.edgeArrowAngle(a, b), 5, "#ffca28");
    }
  }

  drawArrow(x, y, ang, len, fill = "#66bb6a") {
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.moveTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    this.ctx.lineTo(x + Math.cos(ang + 2.6) * len * 0.6, y + Math.sin(ang + 2.6) * len * 0.6);
    this.ctx.lineTo(x + Math.cos(ang - 2.6) * len * 0.6, y + Math.sin(ang - 2.6) * len * 0.6);
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
    for (const cfg of PINKY_FLEET) {
      const path = pinkyPathForRole(cfg.role);
      const pos = samplePolyline(path, this.state.pinkyT + cfg.pathOffset);
      const p = this.toPx(pos.x, pos.y);
      this.ctx.fillStyle = "#e91e8c";
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(4, this.scale * 2.2), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#ffcce8";
      this.ctx.font = "10px system-ui,sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(cfg.id, p.x, p.y - 8);
    }
  }

  drawLegend() {
    const items = [
      ["#e8f0ea", "Map boundary"],
      ["#ffb6c1", "Reliable localization"],
      ["#4285f4", "JetCobot work cell"],
      ["#43a047", "Square traffic loop (clockwise)"],
      ["#ffc107", "Conveyor spur (outside stadium)"],
      ["#e91e8c", "Pinky Pro"],
      ["#c62828", "토마토"],
      ["#ffc107", "등급 컨베이어 (스타디움 밖)"],
      ["#fff59d", "양액 탱크 (남쪽 벽, 고정)"],
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
      "대기 — 암 홈",
      "수확 — 북쪽 재배대",
      "1차 투입 — 작업셀 크레이트",
      "이송 — Pinky Pro (JetCobot 아래 통로)",
      "컨베이어 투입 — 스타디움 남쪽 밖",
      "등급 판별 — 비전·분류 (A/B/폐기)",
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
