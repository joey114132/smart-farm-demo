import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import URDFLoader from "urdf-loader";
import {
  MAP,
  LOCALIZATION_ZONE,
  JETCOBOT_STATIONS,
  FARM_BEDS,
  TRAFFIC_LOOP_CM,
  CONVEYOR_SPUR_CM,
  PINKY_PATH_CM,
  NUTRIENT_AREA,
  PINKY_SOUTH_AISLE_Y,
  PINKY_JETCOBOT_AISLE_Y,
  CONVEYOR_GRADE_LINE,
  MAP_EXTENTS,
  cmToM,
  samplePolyline,
  workCellRect,
} from "./layout.js";

/** Build Three.js farm scene with real JetCobot + Pinky Pro URDF meshes. */
export class FarmScene3D {
  /**
   * @param {HTMLElement} mount
   * @param {{ pinkyT: number, harvestPhase: number, activeStation: string }} state
   */
  constructor(mount, state) {
    this.mount = mount;
    this.state = state;
    this.jetcobots = [];
    this.pinkies = [];
    this.tomatoes = [];
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a100e);
    this.scene.fog = new THREE.Fog(0x0a100e, 4, 14);

    const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.05, 40);
    this.camera.position.set(1.4, 2.2, 3.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.shadowMap.enabled = true;
    mount.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.5, 0.4, 1.1);
    this.controls.enableDamping = true;

    this.addLights();
    this.buildFloor();
    this.buildNutrientTanks();
    this.buildFarmBeds();
    this.buildWorkCells();
    this.buildConveyorLine();
    this.buildTrafficRibbon();
    this.setStatus("Map ready — loading URDFs…");

    this.loadRobots().catch((err) => {
      console.error("URDF load failed", err);
      this.setStatus(`URDF error: ${err.message}`);
    });

    window.addEventListener("resize", () => this.onResize());
  }

  setStatus(msg) {
    const el = document.getElementById("load-status");
    if (el) el.textContent = msg;
  }

  addLights() {
    this.scene.add(new THREE.AmbientLight(0xb8c8be, 0.55));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(2, 4, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-2, 2, -1);
    this.scene.add(fill);
  }

  buildFloor() {
    const totalW = MAP.widthCm * 0.01 + 0.6;
    const totalD =
      (MAP_EXTENTS.yMax - MAP_EXTENTS.yMin) * 0.01 + 0.25;
    const floorGeo = new THREE.PlaneGeometry(totalW, totalD);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2420, roughness: 0.92 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    const centerY = (MAP_EXTENTS.yMax + MAP_EXTENTS.yMin) / 2;
    floor.position.set(MAP.widthCm * 0.005, 0, centerY * 0.01);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(3, 30, 0x2a4038, 0x1a2822);
    grid.position.set(MAP.widthCm * 0.005, 0.002, MAP.heightCm * 0.005);
    this.scene.add(grid);

    // ponytail: localization zone는 시각 힌트만 — Nav2 costmap 아님
    const locW = (LOCALIZATION_ZONE.xMax - LOCALIZATION_ZONE.xMin) * 0.01;
    const locD = (LOCALIZATION_ZONE.yMax - LOCALIZATION_ZONE.yMin) * 0.01;
    const loc = new THREE.Mesh(
      new THREE.PlaneGeometry(locW, locD),
      new THREE.MeshBasicMaterial({ color: 0xffb6c1, transparent: true, opacity: 0.12 }),
    );
    loc.rotation.x = -Math.PI / 2;
    const locC = cmToM(
      (LOCALIZATION_ZONE.xMin + LOCALIZATION_ZONE.xMax) / 2,
      (LOCALIZATION_ZONE.yMin + LOCALIZATION_ZONE.yMax) / 2,
    );
    loc.position.set(locC.x, 0.003, locC.z);
    this.scene.add(loc);

    const wallMat = new THREE.LineBasicMaterial({ color: 0xe8f0ea });
    const hw = MAP.widthCm * 0.01;
    const hd = MAP.heightCm * 0.01;
    const wallPts = [
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(hw, 0.02, 0),
      new THREE.Vector3(hw, 0.02, hd),
      new THREE.Vector3(0, 0.02, hd),
      new THREE.Vector3(0, 0.02, 0),
    ];
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wallPts), wallMat));
  }

  /** 남쪽 벽 양액 탱크 — Pinky 녹색 루프는 이 위를 통과 */
  buildNutrientTanks() {
    const n = NUTRIENT_AREA;
    const w = (n.xMax - n.xMin) * 0.01;
    const d = (n.yMax - n.yMin) * 0.01;
    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.22, d),
      new THREE.MeshStandardMaterial({
        color: 0xfff176,
        metalness: 0.25,
        roughness: 0.55,
        emissive: 0x3d3500,
        emissiveIntensity: 0.15,
      }),
    );
    const c = cmToM((n.xMin + n.xMax) / 2, (n.yMin + n.yMax) / 2);
    tank.position.set(c.x, 0.11, c.z);
    tank.castShadow = true;
    tank.receiveShadow = true;
    this.scene.add(tank);
  }

  buildFarmBeds() {
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3d5c34, roughness: 0.9 });
    const trellisMat = new THREE.MeshStandardMaterial({ color: 0x8d6e4c, metalness: 0.2 });

    for (const bed of FARM_BEDS) {
      const w = bed.widthCm * 0.01;
      const d = (bed.zMaxCm - bed.zMinCm) * 0.01;
      const bedMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), soilMat);
      const c = cmToM(bed.xCenter, (bed.zMinCm + bed.zMaxCm) / 2);
      bedMesh.position.set(c.x, 0.04, c.z);
      bedMesh.receiveShadow = true;
      this.scene.add(bedMesh);

      for (let i = 0; i < 3; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), trellisMat);
        const px = bed.xCenter - bed.widthCm / 2 + ((i + 0.5) / 3) * bed.widthCm;
        const p = cmToM(px, (bed.zMinCm + bed.zMaxCm) / 2);
        post.position.set(p.x, 0.28, p.z);
        this.scene.add(post);
      }

      for (let r = 0; r < bed.rows; r++) {
        for (let c = 0; c < bed.plantsPerRow; c++) {
          const px = bed.xCenter - bed.widthCm / 2 + ((c + 0.5) / bed.plantsPerRow) * bed.widthCm;
          const py = bed.zMinCm + ((r + 0.5) / bed.rows) * (bed.zMaxCm - bed.zMinCm);
          const pos = cmToM(px, py);
          const tomato = new THREE.Mesh(
            new THREE.SphereGeometry(0.022, 10, 10),
            new THREE.MeshStandardMaterial({ color: 0xc62828, emissive: 0x4a0000, emissiveIntensity: 0.25 }),
          );
          tomato.position.set(pos.x, 0.35 + r * 0.08, pos.z);
          tomato.castShadow = true;
          tomato.userData = { stationId: bed.stationId, row: r, col: c, picked: false };
          this.scene.add(tomato);
          this.tomatoes.push(tomato);
        }
      }
    }
  }

  buildWorkCells() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4285f4,
      transparent: true,
      opacity: 0.15,
      metalness: 0.1,
    });
    for (const st of JETCOBOT_STATIONS) {
      const r = workCellRect(st);
      const w = (r.xMax - r.xMin) * 0.01;
      const d = (r.yMax - r.yMin) * 0.01;
      const cell = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
      const c = cmToM(st.x, st.y);
      cell.position.set(c.x, 0.01, c.z);
      this.scene.add(cell);

      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63 }),
      );
      crate.position.set(c.x, 0.06, c.z - 0.08);
      crate.userData.crate = true;
      this.scene.add(crate);
    }

    // Pinky 통로 — 남변(양액 위) + 북변(JetCobot 아래)
    const aisleMat = new THREE.MeshStandardMaterial({
      color: 0xe91e8c,
      transparent: true,
      opacity: 0.2,
      emissive: 0x4a1135,
      emissiveIntensity: 0.4,
    });
    const southAisle = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.08), aisleMat);
    southAisle.rotation.x = -Math.PI / 2;
    const southC = cmToM(50, PINKY_SOUTH_AISLE_Y);
    southAisle.position.set(southC.x, 0.008, southC.z);
    this.scene.add(southAisle);

    const northAisle = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.14), aisleMat);
    northAisle.rotation.x = -Math.PI / 2;
    const northC = cmToM(50, PINKY_JETCOBOT_AISLE_Y);
    northAisle.position.set(northC.x, 0.008, northC.z);
    this.scene.add(northAisle);
  }

  buildConveyorLine() {
    const c = CONVEYOR_GRADE_LINE;
    const len = (c.xMax - c.xMin) * 0.01;
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.06, c.widthCm * 0.01),
      new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.35, roughness: 0.55 }),
    );
    const center = cmToM((c.xMin + c.xMax) / 2, c.yCenter);
    belt.position.set(center.x, 0.03, center.z);
    this.scene.add(belt);
    this.conveyorTomatoes = [];
    for (let i = 0; i < 6; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xc62828 }),
      );
      sphere.position.set(center.x, 0.09, center.z);
      this.scene.add(sphere);
      this.conveyorTomatoes.push(sphere);
    }
    const cam = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x212121, emissive: 0x004d40, emissiveIntensity: 0.6 }),
    );
    const vis = cmToM(50, -30);
    cam.position.set(vis.x, 0.18, vis.z);
    this.scene.add(cam);
  }

  buildTrafficRibbon() {
    this.addPolylineRibbon(TRAFFIC_LOOP_CM, true, 0x43a047, 0x1b5e20);
    this.addPolylineRibbon(CONVEYOR_SPUR_CM, false, 0xffc107, 0x5d4037);
  }

  /** 직선 세그먼트 리본 — 사각 루프는 모서리에서 둥글지 않음 */
  addPolylineRibbon(points, closed, color, emissive) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.35,
    });
    const count = closed ? points.length : points.length - 1;
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const start = cmToM(a.x, a.y);
      const end = cmToM(b.x, b.y);
      const dir = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
      const len = dir.length();
      if (len < 0.002) continue;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), mat);
      cyl.position.set((start.x + end.x) / 2, 0.04, (start.z + end.z) / 2);
      cyl.quaternion.setFromUnitVectors(up, dir.normalize());
      this.scene.add(cyl);
    }
  }

  async loadRobots() {
    this.setStatus("Loading JetCobot URDF…");
    const loader = new URDFLoader();
    loader.packages = {
      mycobot_description: "assets/jetcobot",
      pinky_description: "assets/pinkypro",
    };
    loader.loadMeshCb = (path, manager, done) => {
      if (/\.dae$/i.test(path)) {
        new ColladaLoader(manager).load(
          path,
          (collada) => done(collada.scene),
          undefined,
          (err) => {
            console.warn("DAE fail", path, err);
            done(new THREE.Group());
          },
        );
        return;
      }
      done(new THREE.Group());
    };

    for (const st of JETCOBOT_STATIONS) {
      const robot = await this.loadUrdf(loader, "assets/jetcobot/jetcobot.urdf");
      const pos = cmToM(st.x, st.y);
      robot.position.set(0, 0, 0);
      // 북쪽 재배대(+Z)를 향하도록 베이스 회전
      robot.rotation.y = -Math.PI / 2;
      robot.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const mount = new THREE.Group();
      mount.position.set(pos.x, 0, pos.z);
      mount.add(robot);
      mount.userData.stationId = st.id;
      mount.userData.robot = robot;
      this.scene.add(mount);
      this.jetcobots.push(mount);
    }

    this.setStatus("Loading Pinky Pro URDF…");
    for (let i = 0; i < 3; i++) {
      const robot = await this.loadUrdf(loader, "assets/pinkypro/pinkypro.urdf");
      // urdf-loader는 ROS Z-up을 그대로 둠 → X축 -90°로 세움
      robot.rotation.x = -Math.PI / 2;
      robot.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const mount = new THREE.Group();
      mount.add(robot);
      mount.userData.pathOffset = i / 3;
      mount.userData.robot = robot;
      this.scene.add(mount);
      this.pinkies.push(mount);
    }

    this.setStatus("Simulation ready");
  }

  loadUrdf(loader, url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  /** 관절값 선형 보간 */
  lerpPose(a, b, t) {
    const out = {};
    for (const k of Object.keys(a)) out[k] = a[k] + (b[k] - a[k]) * t;
    return out;
  }

  applyJetcobotPose(robot, pose) {
    const set = (name, val) => {
      if (robot.joints[name]) robot.joints[name].setJointValue(val);
    };
    set("joint2_to_joint1", pose.j2);
    set("joint3_to_joint2", pose.j3);
    set("joint4_to_joint3", pose.j4);
    set("joint5_to_joint4", pose.j5);
    set("joint6_to_joint5", pose.j6);
    set("gripper_controller", pose.grip);
  }

  /** 수확 사이클: 홈 → 북쪽 재배대 → 집기 → 크레이트 투입 */
  animateJetcobot(robot, phase, stationId) {
    const home = { j2: 0.05, j3: -0.35, j4: 1.15, j5: 0.65, j6: 0, grip: 0.05 };
    const reach = { j2: -1.05, j3: 0.45, j4: -0.55, j5: 1.35, j6: 0.25, grip: 0.05 };
    const pick = { j2: -1.12, j3: 0.52, j4: -0.62, j5: 1.42, j6: 0.28, grip: -0.58 };
    const crate = { j2: 0.72, j3: -0.95, j4: 1.55, j5: 0.35, j6: -0.45, grip: -0.58 };
    const release = { j2: 0.72, j3: -0.95, j4: 1.55, j5: 0.35, j6: -0.45, grip: 0.05 };

    const active = this.state.activeStation === stationId;
    if (!active) {
      this.applyJetcobotPose(robot, home);
      return;
    }

    const p = phase;
    let pose = home;
    if (p < 0.12) {
      pose = home;
    } else if (p < 0.28) {
      const t = (p - 0.12) / 0.16;
      pose = this.lerpPose(home, reach, t);
    } else if (p < 0.38) {
      const t = (p - 0.28) / 0.1;
      pose = this.lerpPose(reach, pick, t);
    } else if (p < 0.52) {
      pose = pick;
    } else if (p < 0.68) {
      const t = (p - 0.52) / 0.16;
      pose = this.lerpPose(pick, crate, t);
    } else if (p < 0.78) {
      const t = (p - 0.68) / 0.1;
      pose = this.lerpPose(crate, release, t);
    } else if (p < 0.9) {
      const t = (p - 0.78) / 0.12;
      pose = this.lerpPose(release, home, t);
    } else {
      pose = home;
    }
    this.applyJetcobotPose(robot, pose);
  }

  updatePinkies() {
    this.pinkies.forEach((mount, i) => {
      const robot = mount.userData.robot;
      const t = this.state.pinkyT + (mount.userData.pathOffset || 0);
      const pos = samplePolyline(PINKY_PATH_CM, t);
      const m = cmToM(pos.x, pos.y);
      mount.position.set(m.x, 0, m.z);
      mount.rotation.set(0, pos.heading, 0);
      if (robot?.joints?.l_wheel_joint) {
        robot.joints.l_wheel_joint.setJointValue(t * 24 + i);
      }
      if (robot?.joints?.r_wheel_joint) {
        robot.joints.r_wheel_joint.setJointValue(t * 24 + i);
      }
    });
  }

  updateConveyor() {
    if (!this.conveyorTomatoes?.length) return;
    const c = CONVEYOR_GRADE_LINE;
    this.conveyorTomatoes.forEach((mesh, i) => {
      const t = (this.state.conveyorT + i / this.conveyorTomatoes.length) % 1;
      const xCm = c.xMin + t * (c.xMax - c.xMin);
      const m = cmToM(xCm, c.yCenter);
      mesh.position.set(m.x, 0.09, m.z);
      const mat = mesh.material;
      if (xCm > 74) mat.color.setHex(0x616161);
      else if (xCm > 58) mat.color.setHex(0x2e7d32);
      else if (xCm > 38) mat.color.setHex(0xef6c00);
      else mat.color.setHex(0xc62828);
    });
  }

  updateTomatoes() {
    const phase = this.state.harvestPhase;
    const picking = phase > 0.2 && phase < 0.55;
    for (const t of this.tomatoes) {
      if (!picking || t.userData.stationId !== this.state.activeStation) continue;
      if (phase > 0.38 && !t.userData.picked) {
        t.userData.picked = true;
        t.visible = false;
      }
      if (phase < 0.05) {
        t.userData.picked = false;
        t.visible = true;
      }
    }
  }

  onResize() {
    const w = this.mount.clientWidth;
    const h = Math.max(this.mount.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    const phase = this.state.harvestPhase;
    this.jetcobots.forEach((mount) =>
      this.animateJetcobot(mount.userData.robot, phase, mount.userData.stationId),
    );
    this.updatePinkies();
    this.updateTomatoes();
    this.updateConveyor();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
