import { createPersistedStore } from "../../lib/stores";

export interface Settings {
  // Bubbles
  growthRate: number;
  maxRadius: number;
  brushRadius: number;
  // Physics
  physicsMode: number;  // 0=static, 1=float, 2=drip
  gravity: number;
  viscosity: number;
  // Appearance
  thickness: number;    // maps to density threshold
  densityScale: number; // per-bubble contribution (lower = more stacking depth)
  softness: number;     // 0=sharp bubbles, 1=soft clouds
  depthScale: number;   // visual depth exaggeration
  opacity: number;
  colorHue: number;
  colorSat: number;
  colorVal: number;
  useBaseColor: number; // 0=per-stroke hue, 1=base color
  // Lighting
  shininess: number;
  ambient: number;
  specStrength: number;
  rimPower: number;
  rimStrength: number;
  lightAngleX: number;
  lightAngleY: number;
}

export const DEFAULTS: Settings = {
  growthRate: 2.0,
  maxRadius: 3.0,
  brushRadius: 3,
  physicsMode: 0,
  gravity: 15,
  viscosity: 0.3,
  thickness: 0.08,
  densityScale: 0.15,
  softness: 0.5,
  depthScale: 3.0,
  opacity: 1.0,
  colorHue: 0.55,
  colorSat: 0.7,
  colorVal: 0.9,
  useBaseColor: 0,
  shininess: 32,
  ambient: 0.25,
  specStrength: 0.6,
  rimPower: 3.0,
  rimStrength: 0.4,
  lightAngleX: 0.4,
  lightAngleY: 0.6,
};

export const settingsStore = createPersistedStore<Settings>("bubble-map:settings", DEFAULTS);
