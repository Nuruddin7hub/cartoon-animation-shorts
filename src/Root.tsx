import React from "react";
import { Composition } from "remotion";
import { PeigneurShort, PEIGNEUR_FRAMES } from "./videos/peigneur/Peigneur";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PeigneurShort"
    component={PeigneurShort}
    durationInFrames={PEIGNEUR_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
