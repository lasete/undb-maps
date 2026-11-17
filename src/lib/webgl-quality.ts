export interface SceneQuality {
  name: "economy" | "balanced" | "high";
  dpr: number;
  antialias: boolean;
  shadows: boolean;
  shadowSize: 512 | 1024;
  postprocessing: boolean;
  animateIntro: boolean;
}

export interface DeviceHints {
  width: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  memoryGb?: number;
  cores?: number;
}

/** Perfil determinístico: o mapa continua 3D em todos os níveis. */
export function sceneQualityFor({ width, coarsePointer, reducedMotion, memoryGb = 8, cores = 8 }: DeviceHints): SceneQuality {
  const constrained = memoryGb <= 4 || cores <= 4;
  if (coarsePointer || width <= 720 || constrained) {
    return {
      name: "economy",
      dpr: 1,
      antialias: false,
      shadows: false,
      shadowSize: 512,
      postprocessing: false,
      animateIntro: !reducedMotion,
    };
  }
  if (width <= 1280 || memoryGb <= 8) {
    return {
      name: "balanced",
      dpr: 1.25,
      antialias: true,
      shadows: true,
      shadowSize: 512,
      postprocessing: false,
      animateIntro: !reducedMotion,
    };
  }
  return {
    name: "high",
    dpr: 1.5,
    antialias: true,
    shadows: true,
    shadowSize: 1024,
    postprocessing: true,
    animateIntro: !reducedMotion,
  };
}
