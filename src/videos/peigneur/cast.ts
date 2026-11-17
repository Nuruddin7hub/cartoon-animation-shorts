import * as THREE from "three";
import { NOINK } from "./ink";
import { cardShade, blobMaterial } from "./cardshade";
import { Pen, bodyFront, Expr, Outfit, SKINS, fxSplash, fxPuff, fxCreak } from "./toon";
import { PeigneurState } from "./story";

export const RIG_WORKER: Outfit = { jacket: "#e07a2c", pants: "#394b63", boots: "#241726", hat: "cap", cap: "#f2c12e" };
export const MINER: Outfit = { jacket: "#4b6584", pants: "#2f3640", boots: "#241726", hat: "cap", cap: "#f7d046" };
export const FISHERMAN: Outfit = { jacket: "#5e8c61", pants: "#6b5b4b", boots: "#3d2c22", hat: "cap", cap: "#c8553d" };

function makeBlobTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgb(130, 125, 138)");
  g.addColorStop(1, "rgb(255, 255, 255)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type CardActor = {
  mesh: THREE.Mesh;
  blob: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  tex: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  pen: Pen;
  outfit: Outfit;
  seed: number;
  lastKey: string;
};

function createActor(outfit: Outfit, seed: number, blobTex: THREE.Texture, heightM = 2.0): CardActor {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 1000;
  const ctx = c.getContext("2d")!;
  const pen = new Pen(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = cardShade(
    new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide })
  );
  const w = heightM * 0.6;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, heightM), mat);
  mesh.geometry.translate(0, heightM / 2, 0);
  mesh.layers.set(NOINK);

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), blobMaterial(blobTex));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.layers.set(NOINK);

  return { mesh, blob, mat, tex, ctx, pen, outfit: { ...outfit, skin: SKINS[seed % SKINS.length] }, seed, lastKey: "" };
}

function redrawActor(a: CardActor, expr: Expr, blink: boolean, phase: number, lean = 0, armsUp = false) {
  const key = `${expr}_${blink ? 1 : 0}_${Math.round(phase * 8)}_${Math.round(lean * 10)}_${armsUp ? 1 : 0}`;
  if (key === a.lastKey) return;
  a.lastKey = key;
  a.ctx.clearRect(0, 0, 600, 1000);
  bodyFront(a.pen, a.outfit, {
    seed: a.seed,
    expr,
    blink,
    mode: phase !== 0 ? "stroll" : "stand",
    phase,
    tilt: lean,
    wave: armsUp ? 0.85 : undefined,
  });
  a.tex.needsUpdate = true;
}

export class PeigneurCast {
  root = new THREE.Group();
  rigCrew: CardActor[] = [];
  miners: CardActor[] = [];
  fisherman: CardActor;
  fxSprite: THREE.Mesh;
  fxTex: THREE.CanvasTexture;
  fxCtx: CanvasRenderingContext2D;
  fxPen: Pen;

  constructor() {
    const bTex = makeBlobTex();
    for (let i = 0; i < 3; i++) {
      const a = createActor(RIG_WORKER, 10 + i, bTex, 1.9);
      this.rigCrew.push(a);
      this.root.add(a.mesh, a.blob);
    }
    for (let i = 0; i < 6; i++) {
      const a = createActor(MINER, 20 + i, bTex, 1.85);
      this.miners.push(a);
      this.root.add(a.mesh, a.blob);
    }
    this.fisherman = createActor(FISHERMAN, 42, bTex, 1.9);
    this.root.add(this.fisherman.mesh, this.fisherman.blob);

    const fc = document.createElement("canvas");
    fc.width = 512;
    fc.height = 512;
    this.fxCtx = fc.getContext("2d")!;
    this.fxPen = new Pen(this.fxCtx);
    this.fxTex = new THREE.CanvasTexture(fc);
    this.fxTex.colorSpace = THREE.SRGBColorSpace;
    this.fxSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      new THREE.MeshBasicMaterial({ map: this.fxTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    this.fxSprite.layers.set(NOINK);
    this.fxSprite.visible = false;
    this.root.add(this.fxSprite);
  }

  update(id: number, f: number, st: PeigneurState, camPos: THREE.Vector3) {
    const t = f / 30;
    const blinkFor = (seed: number) => ((f + seed * 17) % 68) < 4;

    const placeActor = (a: CardActor, x: number, y: number, z: number, vis: boolean, expr: Expr, phase = 0, lean = 0, armsUp = false) => {
      a.mesh.visible = vis;
      a.blob.visible = vis;
      if (!vis) return;
      a.mesh.position.set(x, y, z);
      a.blob.position.set(x, y + 0.03, z);
      a.mesh.lookAt(camPos.x, y, camPos.z);
      redrawActor(a, expr, blinkFor(a.seed), phase, lean, armsUp);
    };

    if (id === 2) {
      placeActor(this.fisherman, -10, 0.55, 6, true, "neutral", 0);
    } else if (id === 10 || id === 11) {
      placeActor(this.fisherman, -16, 0.85, -3, true, "relief", 0);
    } else {
      placeActor(this.fisherman, 0, -50, 0, false, "neutral");
    }

    const rigBaseY = 1.05 - st.rigSink * 10;
    this.rigCrew.forEach((a, i) => {
      if (id === 1 || id === 4 || id === 6) {
        const expr: Expr = id === 4 ? "stern" : "shock";
        placeActor(a, -1.8 + i * 1.7, rigBaseY, 1.8, true, expr, id === 4 ? 0 : Math.sin(t * 6 + i), st.rigTilt * 0.5, id === 1 || id === 6);
      } else if (id === 10) {
        placeActor(a, -14 + i * 1.5, 0.85, -5, true, "relief", 0);
      } else {
        placeActor(a, 0, -50, 0, false, "neutral");
      }
    });

    this.miners.forEach((a, i) => {
      if (id === 3 || id === 5 || id === 6) {
        const expr: Expr = id === 6 && st.breach > 0.3 ? "shock" : "neutral";
        const mx = -5 + (i % 3) * 4.5 + (i >= 3 ? 1.2 : 0);
        const mz = i < 3 ? -4 : 3;
        placeActor(a, mx, -21.95, mz, true, expr, id === 6 ? (t * 2.5 + i * 0.3) % 1 : 0, 0, id === 6 && st.breach > 0.3);
      } else if (id === 10) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        placeActor(a, -7.8 + col * 0.8, st.elevatorY + 0.15, -0.6 + row * 1.1, true, "relief", 0);
      } else {
        placeActor(a, 0, -50, 0, false, "neutral");
      }
    });

    this.fxSprite.visible = false;
    if (id === 5 && f > 680 && f < 735) {
      this.fxSprite.visible = true;
      this.fxSprite.position.set(0, -13.0, 1.5);
      this.fxSprite.lookAt(camPos);
      this.fxCtx.clearRect(0, 0, 512, 512);
      fxCreak(this.fxPen, (f - 680) / 55);
      this.fxTex.needsUpdate = true;
    } else if (id === 6 && st.breach > 0.4) {
      this.fxSprite.visible = true;
      this.fxSprite.position.set(0, -14.0, 1.5);
      this.fxSprite.lookAt(camPos);
      this.fxCtx.clearRect(0, 0, 512, 512);
      fxSplash(this.fxPen, ((f - 800) % 24) / 24);
      this.fxTex.needsUpdate = true;
    } else if (id === 11 && st.bargePop > 0.15 && st.bargePop < 0.95) {
      this.fxSprite.visible = true;
      this.fxSprite.position.set(2, 1.4, 3);
      this.fxSprite.lookAt(camPos);
      this.fxCtx.clearRect(0, 0, 512, 512);
      fxPuff(this.fxPen, (f % 30) / 30);
      this.fxTex.needsUpdate = true;
    }
  }
}
