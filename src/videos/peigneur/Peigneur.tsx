import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { PeigneurWorld } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

export const PEIGNEUR_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({
  ink: true,
  lens: true,
  pre: true,
  bloom: true,
  grade: true,
  grain: false,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}),
});

const makeBloom = () =>
  new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.5,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    levels: 5,
    radius: 0.6,
  });

const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { gl, camera, scene, size } = useThree();
  const world = useMemo(() => new PeigneurWorld(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);

  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl, { multisampling: 0 });
    const renderPass = new RenderPass(scene, camera);
    const ink = new InkPass(scene, camera as THREE.PerspectiveCamera);
    const lens = new LensBlur({ maxCoC: 24, nearScale: 1.2 });
    const bloom = makeBloom();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const grade = new GradeEffect(GRADES.day, GRADE_STRENGTH.day);
    const grain = new GrainEffect({ amount: 0.025, cellPx: 1.5 });

    composer.addPass(renderPass);
    if (on.ink) composer.addPass(ink);
    if (on.lens && on.pre) composer.addPass(new EffectPass(camera, lens.pre));
    if (on.lens) composer.addPass(new EffectPass(camera, lens.main));

    const effects: any[] = [];
    if (on.bloom) effects.push(bloom);
    effects.push(tone);
    if (on.grade) effects.push(grade);
    if (on.grain) effects.push(grain);
    composer.addPass(new EffectPass(camera, ...effects));

    return { composer, ink, lens, grade, grain };
  }, [gl, camera, scene, on]);

  useEffect(() => {
    pipeline.composer.setSize(size.width, size.height, false);
  }, [pipeline, size.width, size.height]);

  useEffect(() => () => {
    pipeline.ink.dispose();
    pipeline.composer.dispose();
  }, [pipeline]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);

  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f));
  else fpt.copy(target);
  pipeline.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  pipeline.lens.cInf = d.cInf;
  gradeFor(pipeline.grade, SHOTS[id - 1].light);
  pipeline.grain.seed = f;

  useFrame(() => {
    pipeline.composer.render();
  }, 1);

  return <primitive object={world.root} dispose={null} />;
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      {...(dprOverride() ? { dpr: dprOverride() } : {})}
      shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}
    >
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const PeigneurShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => (
        <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />
      ))}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
