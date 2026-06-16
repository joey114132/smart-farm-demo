# Tomato Harvest Smart Farm (JetCobot + Pinky Pro)

Browser demo: **Three.js URDF** 3D view + **2D top-down** map for a 100×200 cm tomato harvest cell.

- **JetCobot** — MyCobot 280 Pi + adaptive gripper (`assets/jetcobot/`)
- **Pinky Pro** — mobile base URDF (`assets/pinkypro/`)

## Run locally

```bash
python3 -m http.server 8767
```

Open http://127.0.0.1:8767 (needs a local server for ES modules + DAE meshes).

## Docs

See [SMART_FARM.md](./SMART_FARM.md) for layout, traffic rules, and ROS 2 mapping.

## URDF provenance

| Robot | Source |
|-------|--------|
| JetCobot | Elephant Robotics `mycobot_description` (MyCobot 280 Pi adaptive gripper) |
| Pinky Pro | `pinky_description` visual meshes |

Meshes are vendored under `assets/` for offline/GitHub use.
