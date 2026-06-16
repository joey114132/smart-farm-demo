# Tomato Harvest Smart Farm — JetCobot + Pinky Pro

Interactive browser demo for the **100 cm × 200 cm** workspace from `smart_farm_map_layout.png`, extended with **tomato beds north of the map frame** where JetCobot arms can reach.

| View | What you see |
|------|----------------|
| **3D (Three.js)** | Real URDF meshes — MyCobot 280 Pi adaptive gripper as **JetCobot**, portfolio **Pinky Pro** mobile base |
| **2D (canvas)** | Same geometry as the analysis diagram + north-side farm rows + live robot positions |

## Quick start

```zsh
cd ~/smart-farm-demo
python3 -m http.server 8767
```

Open [http://127.0.0.1:8767](http://127.0.0.1:8767).

> ES modules and `ColladaLoader` need a local server — `file://` will not load URDF/DAE assets.

## Physical layout (2D map)

```
                    NORTH (+Y / +Z in 3D)
                         │
    ┌────────────────────┴────────────────────┐
    │  Tomato bed A          Tomato bed B      │  ← outside frame (y > 200 cm)
    │  (JetCobot A reach)    (JetCobot B)      │
════╪══════════════════════════════════════════╪════  y = 200 cm (north wall)
    │  ┌──────────┐          ┌──────────┐      │
    │  │ JetCobot │          │ JetCobot │      │  work cells 40×40 cm
    │  │    A     │          │    B     │      │  centers (25,170), (75,170)
    │  └──────────┘          └──────────┘      │
    │         ╭── Pinky aisle (y≈138) under A ── B ──╮   │
    │         │   (below work cells, not inside)   │   │
    │         │                            │   │
    │    P3 (50,80)                        │   │
    │         │                            │   │
    │   P1 (20,30) ─────────────── P2 (80,30)  │
    └──────────────────────────────────────────┘
              SOUTH (origin 0,0)
```

### Zones (from your diagram)

| Zone | Size / rule | Role |
|------|-------------|------|
| **Map boundary** | 100 × 200 cm | Enclosed workspace |
| **Reliable localization** | ≥ 15 cm from walls (pink band) | AMCL / lidar-friendly Nav2 area |
| **JetCobot work cell** | 40 × 40 cm blue squares | Fixed arm + sort crate |
| **Nav2 inflation** | ~18 cm radius around Pinky | Costmap safety buffer |
| **Tomato beds** | 30 × 30 cm north of wall | Harvest target — inside ~28 cm arm reach when extended over the wall |

**Tight corner note:** JetCobot A’s cell touches the 15 cm clearance band at the northwest corner (same as your “Tight Corner!” callout). In production, either shift the cell 2–3 cm inward or reduce inflation near the wall.

## Robots and URDF sources

### JetCobot (stationary harvester)

| Item | Path |
|------|------|
| URDF | `assets/jetcobot/jetcobot.urdf` |
| Source | `jetcobot_ros2/.../mycobot_280_pi_adaptive_gripper.urdf` |
| Meshes | Symlinked `assets/jetcobot/urdf/mycobot_280_pi/` + `adaptive_gripper/` |

Hardware mapping: **Elephant Robotics MyCobot 280 Pi** on Pi 5 — the stack you already use in `jetcobot_ros2/smart_farm` (MoveIt 2, `mycobot_280_pi5_bringup`).

- **6 DOF arm** + adaptive gripper (`gripper_controller` mimic joints)
- **Reach ~280 mm** — beds are placed 5–35 cm north of the north wall so the arm can pick over the fence line
- **Per-station workflow:** reach → close gripper → retract → drop into wooden crate at the work cell

### Pinky Pro (mobile transport)

| Item | Path |
|------|------|
| URDF | `assets/pinkypro/pinkypro.urdf` |
| Meshes | Symlinked from `~/portfolio/assets/models/pinky/meshes/` |

Hardware mapping: **Pinky Pro** differential-drive mobile robot (RPLidar C1, front camera, screen mount in URDF). ROS packages: `vicpinky_description` / `pinky_pro` in your physical-ai workspace.

- **Three units** in the demo (P1, P2, P3 anchors) patrol the same loop with phase offsets
- **Clockwise single loop** on the **JetCobot aisle** at **y ≈ 138 cm** — directly under the south edge of the 40×40 work cells (y = 150), not through the arm stations at y = 170

## How the harvest system works

### 1. Pick (JetCobot)

1. Arm at work cell faces **north** toward the tomato bed aligned with that station.
2. Vision (not simulated here) would select ripe fruit; the demo drives `joint2`–`joint4` through a reach pose and toggles `gripper_controller`.
3. Tomatoes disappear from the bed mesh when the pick phase crosses ~38% of the station cycle.

### 2. Sort (JetCobot)

1. Arm retracts to a neutral pose over the **sort crate** (brown box in the 3D cell).
2. Gripper opens; fruit is conceptually graded (ripe → crate, reject → separate bin — only crate shown).

### 3. Transport (Pinky Pro)

1. Pinky approaches **under** the active JetCobot cell on the east–west aisle (x ≈ 25 or 75, y ≈ 138).
2. Loads crate from the sort bin at the south side of the work cell (arm drops from above).
3. Continues clockwise to the south packing leg (P2) via the right aisle, then back through **P3** staging.

### 4. Traffic rules

The green loop in 2D matches Nav2 practice:

- **One-way clockwise** — no opposite traffic in the 80 cm-wide aisle
- **Inflation disks** at P1/P2/P3 — stand for static keep-out or charging pads
- **Localization band** — Pinkies spend most patrol time inside the pink rectangle for stable AMCL

### Phase timeline (one station cycle)

| Phase | `harvestPhase` | Active robot |
|-------|----------------|--------------|
| Idle | 0.00–0.20 | Arms home |
| Harvest | 0.20–0.55 | JetCobot reaches north bed |
| Sort | 0.55–0.80 | JetCobot → crate |
| Transport | 0.80–1.00 | Pinky Pro advances on loop |

Stations **A** and **B** alternate each full cycle.

## File map

```
smart-farm-demo/
├── index.html              # Split 3D + 2D UI
├── SMART_FARM.md           # This document
├── css/style.css
├── js/
│   ├── layout.js           # Map constants (cm), traffic polyline, farm beds
│   ├── map2d.js            # Canvas top-down renderer
│   ├── scene3d.js          # Three.js + URDFLoader + ColladaLoader
│   └── main.js             # Animation loop + controls
└── assets/
    ├── smart_farm_map_layout.png
    ├── jetcobot/           # MyCobot 280 Pi URDF + mesh symlinks
    └── pinkypro/           # Pinky Pro URDF + mesh symlinks
```

## Relation to ROS 2 stack

This demo is a **layout and motion preview**, not a replacement for Gazebo/Nav2:

| Demo | Production (`jetcobot_ros2` + physical-ai) |
|------|---------------------------------------------|
| Scripted joint poses | `mycobot_280_pi5_moveit_config` / gripper services |
| Canvas traffic loop | `vicpinky_navigation` / Nav2 `navigate_through_poses` |
| Static tomatoes | Perception + harvest state machine |

To close the loop on hardware:

1. Export bed waypoints in the map frame (north of `map` origin).
2. JetCobot: MoveIt pick sequence per bed row (collision-aware).
3. Pinky Pro: Follow `TRAFFIC_LOOP_CM` as a `nav_msgs/Path` with one-way route server.
4. Handshake: MQTT/ROS service “crate_ready” at each work cell before Pinky docks.

## Limits of this preview

- **DAE meshes are large** (~30 MB total) — first load can take several seconds.
- **No physics** — arms do not IK to exact tomato XYZ; poses are illustrative.
- **Pinky crate carry** is not rigidly coupled; focus is map + URDF fidelity + traffic story.

## Verification

```zsh
cd ~/smart-farm-demo
python3 -m http.server 8767
curl -sI http://127.0.0.1:8767/ | head -1
curl -sI http://127.0.0.1:8767/assets/jetcobot/jetcobot.urdf | head -1
curl -sI http://127.0.0.1:8767/assets/pinkypro/pinkypro.urdf | head -1
```

Expected: HTTP `200` on index and both URDF files.
