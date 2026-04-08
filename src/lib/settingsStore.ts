import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";

export interface Settings {
  cameraStrength: number;
  audioBoostMin: number;
  audioBoostMax: number;
  velocityDecay: number;
  cameraVelocityDecay: number;
  triggerDecay: number;
  diffusion: number;
  motionThreshold: number;
  renderMode: number;
}

export const DEFAULTS: Settings = {
  cameraStrength: 25,
  audioBoostMin: 0.05,
  audioBoostMax: 8,
  velocityDecay: 0.99,
  cameraVelocityDecay: 0.9,
  triggerDecay: 0.999,
  diffusion: 0.15,
  motionThreshold: 2,
  renderMode: 0,
};

export type SettingsStore = Settings & {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetDefaults: () => void;
};

export const settingsStore = createStore<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value }),
      resetDefaults: () => set(DEFAULTS),
    }),
    {
      name: "wind-vector-settings",
    },
  ),
);
