/** 2D map layout from smart_farm_map_layout.png — units: centimeters, origin bottom-left. */

export const MAP = {
  widthCm: 100,
  heightCm: 200,
  wallClearanceCm: 15,
};

/** 2D/3D 뷰에 잡을 전체 범위 (북쪽 재배대 + 남쪽 컨베이어). */
export const MAP_EXTENTS = {
  xMin: 0,
  xMax: MAP.widthCm,
  yMin: -48,
  yMax: MAP.heightCm + 38,
};

/** 스타디움 남쪽 밖 — 토마토 등급 판별 컨베이어 라인 (cm). */
export const CONVEYOR_GRADE_LINE = {
  xMin: 10,
  xMax: 90,
  yCenter: -30,
  widthCm: 14,
  /** 스타디움 남쪽 벽(y=0) 바로 밖 핸드오프 */
  gateY: -10,
  stations: [
    { id: "infeed", label: "투입", x: 18, y: -10 },
    { id: "vision", label: "비전 등급", x: 50, y: -30 },
    { id: "gradeA", label: "A등급", x: 82, y: -38 },
    { id: "gradeB", label: "B등급", x: 82, y: -30 },
    { id: "reject", label: "폐기", x: 82, y: -22 },
  ],
};

/**
 * 남쪽 벽을 따라 놓인 긴 양액 탱크·믹서·저장 (고정 설비, Pinky 주행 불가).
 * 실제 모형의 NUTRIENT MIXING & STORAGE 스트라이프 존.
 */
export const NUTRIENT_AREA = {
  xMin: 22,
  xMax: 78,
  yMin: 8,
  yMax: 26,
};

/** 양액 구역 위 · 스타디움 내부 Pinky 사각 루프 남변 (cm). */
export const PINKY_SOUTH_AISLE_Y = NUTRIENT_AREA.yMax + 6;

/** 서쪽 여유 통로 — 컨베이어 스퍼가 양액 탱크를 우회 */
export const PINKY_WEST_MARGIN_X = 15;

/** Reliable localization band (≥15 cm from walls). */
export const LOCALIZATION_ZONE = {
  xMin: 15,
  xMax: 85,
  yMin: 15,
  yMax: 185,
};

/** JetCobot 280 Pi work cells (40×40 cm). */
export const JETCOBOT_STATIONS = [
  { id: "A", label: "JetCobot A", x: 25, y: 182, cellSize: 40 },
  { id: "B", label: "JetCobot B", x: 75, y: 182, cellSize: 40 },
];

/**
 * Pinky Pro travel lane — directly under JetCobot work cells.
 * Work-cell south edge is y = station.y - cellSize/2 (= 150 cm).
 */
export const PINKY_JETCOBOT_AISLE_Y =
  JETCOBOT_STATIONS[0].y - JETCOBOT_STATIONS[0].cellSize / 2 - 12;

/** Pinky Pro dock / patrol anchors (녹색 루프 위). */
export const PINKY_ANCHORS = [
  { id: "P1", x: 20, y: PINKY_SOUTH_AISLE_Y },
  { id: "P2", x: 80, y: PINKY_SOUTH_AISLE_Y },
  {
    id: "P3",
    x: 50,
    y: Math.round((PINKY_SOUTH_AISLE_Y + PINKY_JETCOBOT_AISLE_Y) / 2),
  },
];

/** Nav2 inflation radius around each Pinky footprint (cm). */
export const PINKY_INFLATION_CM = 18;

/**
 * 시계 방향 사각 루프 — 스타디움 내부 전용 (녹색).
 * 남변은 양액 탱크 위, 북변은 JetCobot 작업셀 바로 아래.
 */
export const TRAFFIC_LOOP_CM = [
  { x: 20, y: PINKY_SOUTH_AISLE_Y },
  { x: 80, y: PINKY_SOUTH_AISLE_Y },
  { x: 80, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 20, y: PINKY_JETCOBOT_AISLE_Y },
];

/** 스타디움 밖 컨베이어 — 서쪽 여유통로로 내려감 (녹색 아님). */
export const CONVEYOR_SPUR_CM = [
  { x: 20, y: PINKY_SOUTH_AISLE_Y },
  { x: PINKY_WEST_MARGIN_X, y: PINKY_SOUTH_AISLE_Y },
  { x: PINKY_WEST_MARGIN_X, y: CONVEYOR_GRADE_LINE.gateY },
  { x: 50, y: CONVEYOR_GRADE_LINE.gateY },
  { x: PINKY_WEST_MARGIN_X, y: CONVEYOR_GRADE_LINE.gateY },
  { x: PINKY_WEST_MARGIN_X, y: PINKY_SOUTH_AISLE_Y },
  { x: 20, y: PINKY_SOUTH_AISLE_Y },
];

/** Pinky 실제 주행 경로 = 사각 루프(폐합) + 컨베이어 스퍼 (레거시·문서용) */
export const PINKY_PATH_CM = [
  ...TRAFFIC_LOOP_CM,
  TRAFFIC_LOOP_CM[0],
  ...CONVEYOR_SPUR_CM.slice(1),
];

/** 녹색 사각 루프만 (폐합) — Pinky 2대 순찰 */
export const PINKY_LOOP_PATH_CM = [...TRAFFIC_LOOP_CM, TRAFFIC_LOOP_CM[0]];

/** 노란 컨베이어 스퍼 왕복 — Pinky 1대 물류 핸드오프 */
export const PINKY_SPUR_PATH_CM = [...CONVEYOR_SPUR_CM];

/** Pinky 3대: 루프 2 + 스퍼 1 (기존 0 / 0.33 / 0.66 간격 유지) */
export const PINKY_FLEET = [
  { id: "P1", role: "loop", pathOffset: 0 },
  { id: "P2", role: "loop", pathOffset: 0.33 },
  { id: "P3", role: "spur", pathOffset: 0.66 },
];

export function pinkyPathForRole(role) {
  return role === "spur" ? PINKY_SPUR_PATH_CM : PINKY_LOOP_PATH_CM;
}

/**
 * Tomato beds just north of the map frame, inside JetCobot reach.
 * North wall is y = MAP.heightCm; beds sit outside the enclosure.
 */
export const FARM_BEDS = JETCOBOT_STATIONS.map((st) => ({
  stationId: st.id,
  xCenter: st.x,
  zMinCm: MAP.heightCm + 5,
  zMaxCm: MAP.heightCm + 35,
  widthCm: 30,
  rows: 3,
  plantsPerRow: 4,
}));

/** cm → meters for Three.js (X right, Z north). */
export function cmToM(xCm, yCm) {
  return { x: xCm * 0.01, z: yCm * 0.01 };
}

/** Work-cell rectangle corners in cm. */
export function workCellRect(station) {
  const half = station.cellSize / 2;
  return {
    xMin: station.x - half,
    xMax: station.x + half,
    yMin: station.y - half,
    yMax: station.y + half,
  };
}

/** Sample a polyline path by arc length (0–1). */
export function samplePolyline(points, t) {
  if (points.length < 2) return { ...points[0], heading: 0 };
  const segLens = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    segLens.push(len);
    total += len;
  }
  let dist = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i]) {
      const a = points[i];
      const b = points[i + 1];
      const f = segLens[i] > 0 ? dist / segLens[i] : 0;
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const heading = Math.atan2(b.x - a.x, b.y - a.y);
      return { x, y, heading };
    }
    dist -= segLens[i];
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    heading: Math.atan2(last.x - prev.x, last.y - prev.y),
  };
}
