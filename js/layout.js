/** 2D map layout from smart_farm_map_layout.png — units: centimeters, origin bottom-left. */

export const MAP = {
  widthCm: 100,
  heightCm: 200,
  wallClearanceCm: 15,
};

/** Reliable localization band (≥15 cm from walls). */
export const LOCALIZATION_ZONE = {
  xMin: 15,
  xMax: 85,
  yMin: 15,
  yMax: 185,
};

/** JetCobot 280 Pi work cells (40×40 cm). */
export const JETCOBOT_STATIONS = [
  { id: "A", label: "JetCobot A", x: 25, y: 170, cellSize: 40 },
  { id: "B", label: "JetCobot B", x: 75, y: 170, cellSize: 40 },
];

/** Pinky Pro dock / patrol anchors. */
export const PINKY_ANCHORS = [
  { id: "P1", x: 20, y: 30 },
  { id: "P2", x: 80, y: 30 },
  { id: "P3", x: 50, y: 80 },
];

/** Nav2 inflation radius around each Pinky footprint (cm). */
export const PINKY_INFLATION_CM = 18;

/**
 * Pinky Pro travel lane — directly under JetCobot work cells.
 * Work-cell south edge is y = station.y - cellSize/2 (= 150 cm).
 */
export const PINKY_JETCOBOT_AISLE_Y =
  JETCOBOT_STATIONS[0].y - JETCOBOT_STATIONS[0].cellSize / 2 - 12;

/**
 * Clockwise single-loop traffic (prevents head-on conflicts).
 * North leg runs under JetCobot A/B, not through the work cells.
 * @type {Array<{x:number,y:number}>}
 */
export const TRAFFIC_LOOP_CM = [
  { x: 20, y: 30 },
  { x: 20, y: 60 },
  { x: 20, y: 100 },
  { x: 20, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 25, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 50, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 75, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 80, y: PINKY_JETCOBOT_AISLE_Y },
  { x: 80, y: 100 },
  { x: 80, y: 60 },
  { x: 80, y: 30 },
  { x: 65, y: 45 },
  { x: 50, y: 80 },
  { x: 35, y: 45 },
];

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
