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
  PINKY_JETCOBOT_AISLE_Y,
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
    this.buildFarmBeds();
    this.buildWorkCells();
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
    const floorGeo = new THREE.PlaneGeometry(MAP.widthCm * 0.01 + 0.6, MAP.heightCm * 0.01 + 0.8);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2420, roughness: 0.92 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(MAP.widthCm * 0.005, 0, MAP.heightCm * 0.005);
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

    // Pinky 통로 — JetCobot 셀 남쪽 바로 아래
    const aisle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xe91e8c,
        transparent: true,
        opacity: 0.2,
        emissive: 0x4a1135,
        emissiveIntensity: 0.4,
      }),
    );
    aisle.rotation.x = -Math.PI / 2;
    const aisleC = cmToM(50, PINKY_JETCOBOT_AISLE_Y);
    aisle.position.set(aisleC.x, 0.008, aisleC.z);
    this.scene.add(aisle);
  }

  buildTrafficRibbon() {
    const pts = TRAFFIC_LOOP_CM.map((p) => {
      const m = cmToM(p.x, p.y);
      return new THREE.Vector3(m.x, 0.04, m.z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.15);
    const tube = new THREE.TubeGeometry(curve, 120, 0.018, 6, true);
    const mesh = new THREE.Mesh(
      tube,
      new THREE.MeshStandardMaterial({ color: 0x43a047, emissive: 0x1b5e20, emissiveIntensity: 0.35 }),
    );
    this.scene.add(mesh);
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
      robot.position.set(pos.x, 0, pos.z);
      robot.rotation.y = Math.PI;
      robot.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      robot.userData.stationId = st.id;
      this.scene.add(robot);
      this.jetcobots.push(robot);
    }

    this.setStatus("Loading Pinky Pro URDF…");
    for (let i = 0; i < 3; i++) {
      const robot = await this.loadUrdf(loader, "assets/pinkypro/pinkypro.urdf");
      robot.scale.setScalar(1);
      robot.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      robot.userData.pathOffset = i / 3;
      this.scene.add(robot);
      this.pinkies.push(robot);
    }

    this.setStatus("Simulation ready");
  }

  loadUrdf(loader, url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  /** Harvest pose keyed to phase 0–1 for one station. */
  animateJetcobot(robot, phase, stationId) {
    const active = this.state.activeStation === stationId;
    const local = active ? phase : 0;
    const reach = Math.sin(local * Math.PI) * 0.85;
    const pick = local > 0.45 && local < 0.75 ? -0.35 : 0.05;

    const set = (name, val) => {
      if (robot.joints[name]) robot.joints[name].setJointValue(val);
    };
    set("joint2_to_joint1", -0.4 - reach * 0.9);
    set("joint3_to_joint2", 1.0 + reach * 0.55);
    set("joint4_to_joint3", -1.2 - reach * 0.3);
    set("joint5_to_joint4", 0.2);
    set("joint6_to_joint5", 0.5);
    set("gripper_controller", pick);
  }

  updatePinkies() {
    this.pinkies.forEach((robot, i) => {
      const t = this.state.pinkyT + (robot.userData.pathOffset || 0);
      const pos = samplePolyline(TRAFFIC_LOOP_CM, t);
      const m = cmToM(pos.x, pos.y);
      robot.position.set(m.x, 0, m.z);
      robot.rotation.y = -pos.heading;
      if (robot.joints.l_wheel_joint) robot.joints.l_wheel_joint.setJointValue(t * 24 + i);
      if (robot.joints.r_wheel_joint) robot.joints.r_wheel_joint.setJointValue(t * 24 + i);
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
    this.jetcobots.forEach((r) => this.animateJetcobot(r, phase, r.userData.stationId));
    this.updatePinkies();
    this.updateTomatoes();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
