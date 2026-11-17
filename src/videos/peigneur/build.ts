import * as THREE from "three";
import { twoTone, untone, LFB } from "./shade";
import { grassHD, stoneHD, planksHD, beamHD, facadeHD, roofHD, rep } from "./paint";

export const boxGeo = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const lam = (color: number, map?: THREE.Texture) =>
  twoTone(new THREE.MeshLambertMaterial({ color, ...(map ? { map } : {}) }));

export type BuiltWorld = {
  root: THREE.Group;
  rigGroup: THREE.Group;
  drillString: THREE.Group;
  barges: THREE.Group[];
  tugboat: THREE.Group;
  fishBoat: THREE.Group;
  whirlpoolGroup: THREE.Group;
  whirlpoolRings: THREE.Mesh[];
  waterfallGroup: THREE.Group;
  geyserGroup: THREE.Group;
  elevatorGroup: THREE.Group;
  waterJet: THREE.Mesh;
  breachHole: THREE.Mesh;
  lakeSurface: THREE.Mesh;
  shoreSlide: THREE.Group;
};

export function buildPeigneurWorld(): BuiltWorld {
  const root = new THREE.Group();

  const grassMap = rep(grassHD(), 6, 6);
  const stoneMap = rep(stoneHD(), 3, 3);
  const plankMap = rep(planksHD(), 3, 3);
  const beamMap = rep(beamHD(), 1, 2);
  const wallMap = rep(facadeHD("shed", 5.5, 3.2, { wall: "#e8dcc4", shutter: "#8b5a3c", door: true }), 1, 1);
  const roofMap = rep(roofHD("#b35b3d"), 2, 2);

  const grassMat = lam(0x639e48, grassMap);
  const bankMat = lam(0x8a795d, stoneMap);
  const saltMat = lam(0xd7e3ec, stoneMap);
  const saltDarkMat = lam(0x9fb4c7, stoneMap);
  const woodMat = lam(0xb98a52, plankMap);
  const beamMat = lam(0x7a5433, beamMap);
  const steelMat = lam(0x5b6772);
  const rustMat = lam(0xa64d36);
  const yellowMat = lam(0xd9a226);
  const whiteMat = lam(0xf2f4f7);
  const houseMat = lam(0xeadcc2, wallMap);
  const roofMat = lam(0xb65d3f, roofMap);

  // ---------------- 1. Lake basin & surrounding shores ----------------
  // Outer grassy terrain ring (4 quadrants leaving a 26m radius lake basin)
  const makeBank = (x: number, z: number, w: number, d: number, h = 2.6) => {
    const m = new THREE.Mesh(boxGeo(w, h, d), grassMat);
    m.position.set(x, -0.5, z);
    m.receiveShadow = true;
    m.castShadow = true;
    root.add(m);
    return m;
  };
  makeBank(0, -48, 130, 44); // north shore
  makeBank(0, 48, 130, 44);  // south shore
  makeBank(-48, 0, 44, 52);  // west shore
  makeBank(48, 0, 44, 52);   // east shore

  // Lakebed floor (visible when lake drains!)
  const lakeBed = new THREE.Mesh(new THREE.CylinderGeometry(30, 28, 1.5, 32), bankMat);
  lakeBed.position.set(0, -9.2, 0);
  lakeBed.receiveShadow = true;
  root.add(lakeBed);

  // Delcambre Canal cut on the north-west bank
  const canalWallL = new THREE.Mesh(boxGeo(6, 4, 24), bankMat);
  canalWallL.position.set(-14, -0.8, -28);
  const canalWallR = new THREE.Mesh(boxGeo(6, 4, 24), bankMat);
  canalWallR.position.set(-2, -0.8, -28);
  root.add(canalWallL, canalWallR);

  // Sliding shoreline / Live Oak Gardens chunk (65 acres)
  const shoreSlide = new THREE.Group();
  const slideEarth = new THREE.Mesh(boxGeo(12, 2.5, 10), grassMat);
  slideEarth.position.set(-18, -0.4, 10);
  shoreSlide.add(slideEarth);
  const addTree = (parent: THREE.Object3D, x: number, y: number, z: number, s = 1) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 3.2 * s, 8), beamMat);
    trunk.position.y = 1.6 * s;
    trunk.castShadow = true;
    const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.7 * s, 10, 8), lam(0x4c8c3a));
    crown1.position.set(0, 3.6 * s, 0);
    crown1.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.3 * s, 10, 8), lam(0x5fa148));
    crown2.position.set(0.8 * s, 3.1 * s, 0.5 * s);
    crown2.castShadow = true;
    g.add(trunk, crown1, crown2);
    g.position.set(x, y, z);
    parent.add(g);
  };
  addTree(shoreSlide, -16, 0.8, 9, 1.1);
  addTree(shoreSlide, -20, 0.8, 12, 0.9);
  root.add(shoreSlide);

  // Permanent shore trees & boathouse
  for (const [tx, tz, ts] of [[-24, -18, 1.2], [-27, -6, 1.0], [24, -16, 1.3], [26, 8, 1.1], [18, 25, 1.0], [-14, 26, 1.2]] as [number, number, number][]) {
    addTree(root, tx, 0.8, tz, ts);
  }
  const shed = new THREE.Group();
  const shedBody = new THREE.Mesh(boxGeo(5.5, 3.2, 4.2), houseMat);
  shedBody.position.y = 1.6;
  shedBody.castShadow = true;
  const shedRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.0, 4), roofMat);
  shedRoof.position.y = 4.2;
  shedRoof.rotation.y = Math.PI / 4;
  shedRoof.castShadow = true;
  shed.add(shedBody, shedRoof);
  shed.position.set(-22, 0.8, -10);
  root.add(shed);

  // Wooden fishing dock
  const dock = new THREE.Mesh(boxGeo(8, 0.35, 2.6), woodMat);
  dock.position.set(-19, 0.65, -2);
  dock.castShadow = true;
  root.add(dock);

  // ---------------- 2. Lake water surface ----------------
  const lakeMat = twoTone(new THREE.MeshLambertMaterial({ color: 0x3b86c4, transparent: true, opacity: 0.92 }));
  const lakeSurface = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 0.4, 40), lakeMat);
  lakeSurface.position.set(0, 0.0, 0);
  lakeSurface.receiveShadow = true;
  root.add(lakeSurface);

  // ---------------- 3. Texaco Oil Rig & Drill String ----------------
  const rigGroup = new THREE.Group();
  const rigBarge = new THREE.Mesh(boxGeo(9.5, 1.2, 7.5), rustMat);
  rigBarge.position.y = 0.2;
  rigBarge.castShadow = true;
  rigGroup.add(rigBarge);
  const rigDeck = new THREE.Mesh(boxGeo(8.8, 0.25, 6.8), woodMat);
  rigDeck.position.y = 0.92;
  rigGroup.add(rigDeck);
  const cabin = new THREE.Mesh(boxGeo(3.0, 2.2, 2.8), yellowMat);
  cabin.position.set(-2.4, 2.1, -1.2);
  cabin.castShadow = true;
  rigGroup.add(cabin);

  // Derrick lattice tower
  const legOffsets: [number, number][] = [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 11.5, 8), steelMat);
    leg.position.set(lx * 0.72, 6.6, lz * 0.72);
    leg.rotation.z = lx * 0.06;
    leg.rotation.x = -lz * 0.06;
    leg.castShadow = true;
    rigGroup.add(leg);
  }
  for (const h of [3.2, 6.2, 9.2, 12.0]) {
    const s = 2.6 - h * 0.11;
    const half = s / 2;
    const b1 = new THREE.Mesh(boxGeo(s, 0.16, 0.16), steelMat);
    b1.position.set(0, h, half);
    const b2 = new THREE.Mesh(boxGeo(s, 0.16, 0.16), steelMat);
    b2.position.set(0, h, -half);
    const b3 = new THREE.Mesh(boxGeo(0.16, 0.16, s), steelMat);
    b3.position.set(half, h, 0);
    const b4 = new THREE.Mesh(boxGeo(0.16, 0.16, s), steelMat);
    b4.position.set(-half, h, 0);
    rigGroup.add(b1, b2, b3, b4);
  }
  const crown = new THREE.Mesh(boxGeo(1.8, 0.8, 1.8), yellowMat);
  crown.position.y = 12.6;
  rigGroup.add(crown);
  root.add(rigGroup);

  // 14-inch drill string + bit
  const drillString = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 18, 12), steelMat);
  pipe.position.y = 9;
  const bit = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 10), yellowMat);
  bit.rotation.x = Math.PI;
  bit.position.y = -0.5;
  drillString.add(pipe, bit);
  root.add(drillString);

  // ---------------- 4. 11 Barges + Tugboat + Fisherman's Boat ----------------
  const barges: THREE.Group[] = [];
  const bargeColors = [0xc8553d, 0x3b6e8c, 0xd49a35, 0x5c7a52, 0x8b4e6d];
  for (let i = 0; i < 11; i++) {
    const bg = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo(4.2, 0.9, 2.0), lam(bargeColors[i % bargeColors.length]));
    hull.castShadow = true;
    const cargo = new THREE.Mesh(boxGeo(3.2, 0.65, 1.4), woodMat);
    cargo.position.y = 0.65;
    bg.add(hull, cargo);
    const ang = (i / 11) * Math.PI * 2 + 0.4;
    const rad = 11 + (i % 3) * 3.5;
    bg.position.set(Math.cos(ang) * rad, 0.25, Math.sin(ang) * rad);
    bg.rotation.y = ang + 1.2;
    root.add(bg);
    barges.push(bg);
  }

  const tugboat = new THREE.Group();
  const tugHull = new THREE.Mesh(boxGeo(3.8, 1.1, 1.9), rustMat);
  const tugCabin = new THREE.Mesh(boxGeo(1.6, 1.5, 1.4), whiteMat);
  tugCabin.position.set(-0.3, 1.2, 0);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.2, 8), yellowMat);
  stack.position.set(0.6, 1.5, 0);
  tugboat.add(tugHull, tugCabin, stack);
  tugboat.position.set(12, 0.3, -9);
  tugboat.rotation.y = -0.6;
  root.add(tugboat);

  const fishBoat = new THREE.Group();
  const fbHull = new THREE.Mesh(boxGeo(2.8, 0.6, 1.3), woodMat);
  fishBoat.add(fbHull);
  fishBoat.position.set(-10, 0.2, 6);
  fishBoat.rotation.y = 0.4;
  root.add(fishBoat);

  // ---------------- 5. Underground Salt Mine (y = -22 to -12) ----------------
  const mineGroup = new THREE.Group();
  const mineFloor = new THREE.Mesh(boxGeo(34, 1.2, 26), saltDarkMat);
  mineFloor.position.set(0, -22.6, 0);
  mineFloor.receiveShadow = true;
  const mineCeiling = new THREE.Mesh(boxGeo(34, 1.4, 26), saltMat);
  mineCeiling.position.set(0, -12.4, 0);
  const mineBackWall = new THREE.Mesh(boxGeo(34, 10, 1.5), saltMat);
  mineBackWall.position.set(0, -17.5, -12);
  mineGroup.add(mineFloor, mineCeiling, mineBackWall);

  // Salt pillars & timber supports
  for (const [px, pz] of [[-10, -4], [10, -4], [-10, 5], [10, 5]] as [number, number][]) {
    const pillar = new THREE.Mesh(boxGeo(2.6, 9.6, 2.6), saltMat);
    pillar.position.set(px, -17.5, pz);
    pillar.castShadow = true;
    mineGroup.add(pillar);
  }
  for (let x = -12; x <= 12; x += 6) {
    const post = new THREE.Mesh(boxGeo(0.45, 9.5, 0.45), beamMat);
    post.position.set(x, -17.5, -9);
    mineGroup.add(post);
  }
  // Mine rail track + ore cart
  const rail1 = new THREE.Mesh(boxGeo(22, 0.14, 0.14), steelMat);
  rail1.position.set(0, -21.9, -2.5);
  const rail2 = new THREE.Mesh(boxGeo(22, 0.14, 0.14), steelMat);
  rail2.position.set(0, -21.9, -1.5);
  const cart = new THREE.Mesh(boxGeo(2.2, 1.1, 1.2), rustMat);
  cart.position.set(5, -21.2, -2.0);
  mineGroup.add(rail1, rail2, cart);

  // Breach hole + pouring water jet in mine ceiling
  const breachHole = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 1.6, 16),
    new THREE.MeshBasicMaterial({ color: untone(0x0b1622) })
  );
  breachHole.position.set(0, -12.4, 0);
  mineGroup.add(breachHole);

  const waterJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.6, 9.8, 14),
    new THREE.MeshBasicMaterial({ color: untone(0x89cff0), transparent: true, opacity: 0.85 })
  );
  waterJet.position.set(0, -17.3, 0);
  mineGroup.add(waterJet);

  // Mine Elevator Shaft & Cage (at x = -7, z = 0)
  const shaftFrame = new THREE.Mesh(boxGeo(3.2, 23, 0.3), steelMat);
  shaftFrame.position.set(-7, -11, -1.6);
  mineGroup.add(shaftFrame);

  const elevatorGroup = new THREE.Group();
  const cageFloor = new THREE.Mesh(boxGeo(2.8, 0.25, 2.8), steelMat);
  const cageRoof = new THREE.Mesh(boxGeo(2.8, 0.2, 2.8), yellowMat);
  cageRoof.position.y = 3.2;
  for (const [cx, cz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), steelMat);
    bar.position.set(cx, 1.6, cz);
    elevatorGroup.add(bar);
  }
  elevatorGroup.add(cageFloor, cageRoof);
  elevatorGroup.position.set(-7, -21.8, 0);
  mineGroup.add(elevatorGroup);

  root.add(mineGroup);

  // ---------------- 6. Whirlpool, Waterfall, Geyser ----------------
  const whirlpoolGroup = new THREE.Group();
  const whirlpoolRings: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const r = 1.6 + i * 2.2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.35 + i * 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: untone(i % 2 === 0 ? 0xe6f4ff : 0x4ca3dd) })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -4.2 + i * 0.72;
    whirlpoolGroup.add(ring);
    whirlpoolRings.push(ring);
  }
  root.add(whirlpoolGroup);

  // 164-ft reverse waterfall pouring from Delcambre Canal
  const waterfallGroup = new THREE.Group();
  const wfSheet = new THREE.Mesh(
    boxGeo(6.2, 9.5, 1.2),
    new THREE.MeshBasicMaterial({ color: untone(0x7bc8f6), transparent: true, opacity: 0.88 })
  );
  wfSheet.position.set(-8, -3.5, -16);
  wfSheet.rotation.x = 0.22;
  const wfFoam = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: untone(0xf4fbff) })
  );
  wfFoam.scale.set(1.6, 0.5, 1.2);
  wfFoam.position.set(-8, -8.0, -14.5);
  waterfallGroup.add(wfSheet, wfFoam);
  root.add(waterfallGroup);

  // 400-ft geyser blasting from mine shaft
  const geyserGroup = new THREE.Group();
  const geyserCol = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 2.2, 22, 14),
    new THREE.MeshBasicMaterial({ color: untone(0xe6f7ff) })
  );
  geyserCol.position.set(10, 10, -8);
  const geyserTop = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: untone(0xffffff) })
  );
  geyserTop.position.set(10, 21, -8);
  geyserGroup.add(geyserCol, geyserTop);
  root.add(geyserGroup);

  void LFB;
  return {
    root,
    rigGroup,
    drillString,
    barges,
    tugboat,
    fishBoat,
    whirlpoolGroup,
    whirlpoolRings,
    waterfallGroup,
    geyserGroup,
    elevatorGroup,
    waterJet,
    breachHole,
    lakeSurface,
    shoreSlide,
  };
}
