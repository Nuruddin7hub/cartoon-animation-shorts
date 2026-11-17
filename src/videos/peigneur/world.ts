import * as THREE from "three";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR } from "./shade";
import { NOINK } from "./ink";
import { SHOTS, camAt, stateAt, FOREGROUND, FPS, Light } from "./story";
import { buildPeigneurWorld, BuiltWorld } from "./build";
import { PeigneurCast } from "./cast";

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 uTop, uHorizon, uGround, uSunDir, uSunCol;
uniform float uSunDisk, uSunGlow, uHaziness;
void main(){
  float h = clamp(vDir.y, -0.3, 1.0);
  vec3 col = h >= 0.0 ? mix(uHorizon, uTop, pow(h, 0.58)) : mix(uHorizon, uGround, clamp(-h * 4.0, 0.0, 1.0));
  float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += uSunCol * pow(sd, 6.0) * uSunGlow;
  col += uSunCol * smoothstep(0.9965, 0.9992, sd) * uSunDisk * 2.2;
  gl_FragColor = vec4(col, 1.0);
}`;

export class PeigneurWorld {
  root = new THREE.Group();
  built: BuiltWorld;
  cast: PeigneurCast;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  skyMat: THREE.ShaderMaterial;
  skyMesh: THREE.Mesh;
  fgGroup = new THREE.Group();
  lastLight: Light | null = null;

  constructor() {
    this.built = buildPeigneurWorld();
    this.cast = new PeigneurCast();
    this.root.add(this.built.root, this.cast.root, this.fgGroup);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 140;
    const d = 38;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9cc9ff, 0x5c5346, 0.85);
    this.root.add(this.hemi);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color("#3e7fd2") },
        uHorizon: { value: new THREE.Color("#b8d0ec") },
        uGround: { value: new THREE.Color("#738b9c") },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5) },
        uSunCol: { value: new THREE.Color("#fff4d6") },
        uSunDisk: { value: 0.2 },
        uSunGlow: { value: 0.15 },
        uHaziness: { value: 0.15 },
      },
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(650, 24, 16), this.skyMat);
    this.skyMesh.layers.set(NOINK);
    this.root.add(this.skyMesh);
  }

  applyLight(preset: Light, camPos: THREE.Vector3, camLook: THREE.Vector3, scene: THREE.Scene) {
    const L = LIGHTS[preset];
    const K = LOOK[preset];
    const dir = new THREE.Vector3().subVectors(camLook, camPos).setY(0).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const az = (L.az * Math.PI) / 180;
    const el = (L.el * Math.PI) / 180;
    const sunDir = new THREE.Vector3()
      .addScaledVector(dir, -Math.cos(az) * Math.cos(el))
      .addScaledVector(right, Math.sin(az) * Math.cos(el))
      .addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(el))
      .normalize();

    this.sun.position.copy(camLook).addScaledVector(sunDir, 60);
    this.sun.target.position.copy(camLook);
    this.sun.target.updateMatrixWorld();

    TONE.uLitCol.value.set(...L.lit);
    TONE.uShadeCol.value.set(...L.shade);
    TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert;
    TONE.uSideK.value = L.sideK;
    TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce);
    TONE.uSat.value = K.sat;

    CHAR.uCharTint.value.set(...L.charTint);
    CHAR.uCharShade.value = L.charShade;
    CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad;
    CHAR.uSideTint.value.set(...L.sideTint);

    this.skyMat.uniforms.uTop.value.set(L.top);
    this.skyMat.uniforms.uHorizon.value.set(L.hor);
    this.skyMat.uniforms.uSunDir.value.copy(sunDir);
    this.skyMat.uniforms.uSunDisk.value = preset === "golden" ? 1.0 : 0.2;
    this.skyMat.uniforms.uSunGlow.value = preset === "golden" ? 0.55 : 0.15;

    const fogCol = new THREE.Color(L.fog);
    scene.fog = new THREE.Fog(fogCol, L.fogNear, L.fogFar);
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const shot = SHOTS[id - 1];
    const c = camAt(id, f);
    cam.position.set(...c.pos);
    cam.fov = c.fov;
    cam.lookAt(...c.look);
    cam.rotateZ(c.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    this.skyMesh.position.copy(cam.position);
    const lookVec = new THREE.Vector3(...c.look);
    this.applyLight(shot.light, cam.position, lookVec, scene);

    const st = stateAt(id, f);
    const t = f / FPS;

    // 1. Lake & Oil Rig & Drill String
    this.built.lakeSurface.position.y = st.waterLevel;
    this.built.lakeSurface.visible = st.waterLevel > -7.5;

    this.built.rigGroup.position.set(0, st.waterLevel + 0.35 - st.rigSink * 10, 0);
    this.built.rigGroup.rotation.z = -st.rigTilt;
    this.built.rigGroup.rotation.x = st.rigTilt * 0.4;
    this.built.rigGroup.visible = st.rigSink < 0.98;

    this.built.drillString.position.set(0, st.drillY, 0);
    this.built.drillString.rotation.y = t * 8.0;
    this.built.drillString.visible = id <= 7;

    // 2. Barges & Tugboat & Fishboat
    this.built.barges.forEach((b, i) => {
      const baseAng = (i / 11) * Math.PI * 2 + 0.4;
      const baseRad = 11 + (i % 3) * 3.5;
      if (id === 11) {
        // 9 of 11 barges pop back up like corks!
        b.visible = i < 9;
        const popDelay = i * 0.06;
        const p = Math.max(0, Math.min(1, (st.bargePop - popDelay) / 0.35));
        const bounce = p < 1 ? Math.sin(p * Math.PI) * 1.4 : Math.sin(t * 2.2 + i) * 0.12;
        b.position.set(Math.cos(baseAng) * (baseRad * 0.7), -6 + p * 6.2 + bounce, Math.sin(baseAng) * (baseRad * 0.7));
        b.rotation.set(0, baseAng + 1.0, (1 - p) * 0.4);
      } else if (st.vortex > 0.2) {
        const pull = id === 8 ? st.rigSink : st.vortex * 0.25;
        const rad = Math.max(1.5, baseRad * (1 - pull * 0.85));
        const ang = baseAng + t * (0.4 + pull * 1.4);
        b.position.set(Math.cos(ang) * rad, st.waterLevel + 0.2 - pull * 6.5, Math.sin(ang) * rad);
        b.rotation.set(pull * 0.6, ang + 1.2, pull * 0.5);
        b.visible = pull < 0.92;
      } else {
        b.visible = id === 1 || id === 2 || id === 4 || id === 7;
        b.position.set(Math.cos(baseAng) * baseRad, st.waterLevel + 0.2 + Math.sin(t * 1.5 + i) * 0.06, Math.sin(baseAng) * baseRad);
        b.rotation.set(0, baseAng + 1.2, 0);
      }
    });

    this.built.tugboat.visible = id === 2 || id === 4 || id === 7 || (id === 8 && st.rigSink < 0.8);
    this.built.tugboat.position.y = st.waterLevel + 0.25 - (id === 8 ? st.rigSink * 6 : 0);
    this.built.fishBoat.visible = id === 2;
    this.built.fishBoat.position.y = 0.2 + Math.sin(t * 1.8) * 0.05;

    // 3. Whirlpool
    this.built.whirlpoolGroup.visible = st.vortex > 0.05;
    this.built.whirlpoolGroup.scale.setScalar(0.5 + st.vortex * 0.8);
    this.built.whirlpoolRings.forEach((r, i) => {
      r.rotation.z = t * (3.5 - i * 0.4);
    });

    // 4. Mine breach, water jet, elevator
    this.built.breachHole.visible = st.breach > 0.05;
    this.built.breachHole.scale.set(0.3 + st.breach * 1.4, 1, 0.3 + st.breach * 1.4);
    this.built.waterJet.visible = st.breach > 0.15;
    this.built.waterJet.scale.set(0.4 + st.breach * 1.1, 1, 0.4 + st.breach * 1.1);
    this.built.elevatorGroup.position.y = st.elevatorY;

    // 5. Waterfall & Geyser & Shoreline Slide
    this.built.waterfallGroup.visible = st.waterfall > 0.1;
    this.built.geyserGroup.visible = st.geyser > 0.05;
    this.built.geyserGroup.scale.set(1, Math.max(0.05, st.geyser), 1);

    const slideU = id === 8 ? st.rigSink : id >= 9 ? 1 : 0;
    this.built.shoreSlide.position.set(slideU * 6.5, -slideU * 5.0, -slideU * 3.5);
    this.built.shoreSlide.rotation.z = -slideU * 0.25;

    // 6. Foreground framing props
    this.fgGroup.clear();
    const fgs = FOREGROUND[id];
    if (fgs) {
      for (const fg of fgs) {
        const m = new THREE.Mesh(
          fg.type === "grass" ? new THREE.SphereGeometry(1.4, 8, 6) : new THREE.BoxGeometry(0.4, 5, 0.4),
          new THREE.MeshLambertMaterial({ color: fg.type === "grass" ? 0x3b6e2d : 0x5c3e26 })
        );
        m.position.set(...fg.pos);
        m.layers.set(NOINK);
        this.fgGroup.add(m);
      }
    }

    // 7. Characters
    this.cast.update(id, f, st, cam.position);

    return lookVec;
  }
}
