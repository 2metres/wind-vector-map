<script lang="ts">
  import { RangeSlider, SelectInput, SettingsPanel } from "../../lib/ui";
  import { settingsStore, DEFAULTS } from "./settingsStore";

  let growthRate = $state(settingsStore.getState().growthRate);
  let maxRadius = $state(settingsStore.getState().maxRadius);
  let brushRadius = $state(settingsStore.getState().brushRadius);
  let physicsMode = $state(settingsStore.getState().physicsMode);
  let gravity = $state(settingsStore.getState().gravity);
  let viscosity = $state(settingsStore.getState().viscosity);
  let thickness = $state(settingsStore.getState().thickness);
  let densityScale = $state(settingsStore.getState().densityScale);
  let softness = $state(settingsStore.getState().softness);
  let depthScale = $state(settingsStore.getState().depthScale);
  let opacity = $state(settingsStore.getState().opacity);
  let colorHue = $state(settingsStore.getState().colorHue);
  let colorSat = $state(settingsStore.getState().colorSat);
  let colorVal = $state(settingsStore.getState().colorVal);
  let useBaseColor = $state(settingsStore.getState().useBaseColor);
  let shininess = $state(settingsStore.getState().shininess);
  let ambient = $state(settingsStore.getState().ambient);
  let specStrength = $state(settingsStore.getState().specStrength);
  let rimPower = $state(settingsStore.getState().rimPower);
  let rimStrength = $state(settingsStore.getState().rimStrength);
  let lightAngleX = $state(settingsStore.getState().lightAngleX);
  let lightAngleY = $state(settingsStore.getState().lightAngleY);

  $effect(() => { settingsStore.getState().set("growthRate", growthRate); });
  $effect(() => { settingsStore.getState().set("maxRadius", maxRadius); });
  $effect(() => { settingsStore.getState().set("brushRadius", brushRadius); });
  $effect(() => { settingsStore.getState().set("physicsMode", physicsMode); });
  $effect(() => { settingsStore.getState().set("gravity", gravity); });
  $effect(() => { settingsStore.getState().set("viscosity", viscosity); });
  $effect(() => { settingsStore.getState().set("thickness", thickness); });
  $effect(() => { settingsStore.getState().set("densityScale", densityScale); });
  $effect(() => { settingsStore.getState().set("softness", softness); });
  $effect(() => { settingsStore.getState().set("depthScale", depthScale); });
  $effect(() => { settingsStore.getState().set("opacity", opacity); });
  $effect(() => { settingsStore.getState().set("colorHue", colorHue); });
  $effect(() => { settingsStore.getState().set("colorSat", colorSat); });
  $effect(() => { settingsStore.getState().set("colorVal", colorVal); });
  $effect(() => { settingsStore.getState().set("useBaseColor", useBaseColor); });
  $effect(() => { settingsStore.getState().set("shininess", shininess); });
  $effect(() => { settingsStore.getState().set("ambient", ambient); });
  $effect(() => { settingsStore.getState().set("specStrength", specStrength); });
  $effect(() => { settingsStore.getState().set("rimPower", rimPower); });
  $effect(() => { settingsStore.getState().set("rimStrength", rimStrength); });
  $effect(() => { settingsStore.getState().set("lightAngleX", lightAngleX); });
  $effect(() => { settingsStore.getState().set("lightAngleY", lightAngleY); });

  function resetDefaults() {
    settingsStore.getState().resetDefaults();
    growthRate = DEFAULTS.growthRate;
    maxRadius = DEFAULTS.maxRadius;
    brushRadius = DEFAULTS.brushRadius;
    physicsMode = DEFAULTS.physicsMode;
    gravity = DEFAULTS.gravity;
    viscosity = DEFAULTS.viscosity;
    thickness = DEFAULTS.thickness;
    densityScale = DEFAULTS.densityScale;
    softness = DEFAULTS.softness;
    depthScale = DEFAULTS.depthScale;
    opacity = DEFAULTS.opacity;
    colorHue = DEFAULTS.colorHue;
    colorSat = DEFAULTS.colorSat;
    colorVal = DEFAULTS.colorVal;
    useBaseColor = DEFAULTS.useBaseColor;
    shininess = DEFAULTS.shininess;
    ambient = DEFAULTS.ambient;
    specStrength = DEFAULTS.specStrength;
    rimPower = DEFAULTS.rimPower;
    rimStrength = DEFAULTS.rimStrength;
    lightAngleX = DEFAULTS.lightAngleX;
    lightAngleY = DEFAULTS.lightAngleY;
  }
</script>

<SettingsPanel onmousedown={(e) => e.stopPropagation()}>
  <div class="section">
    <h3>Bubbles</h3>
    <RangeSlider label="Growth Rate" bind:value={growthRate} min={0.1} max={10} step={0.1} formatValue={(v) => v.toFixed(1)} />
    <RangeSlider label="Max Radius" bind:value={maxRadius} min={0.5} max={10} step={0.1} formatValue={(v) => v.toFixed(1)} />
    <RangeSlider label="Brush Size" bind:value={brushRadius} min={1} max={10} step={1} />
  </div>

  <div class="section">
    <h3>Physics</h3>
    <SelectInput label="Mode" bind:value={physicsMode}>
      <option value={0}>Static</option>
      <option value={1}>Float (up)</option>
      <option value={2}>Drip (down)</option>
    </SelectInput>
    {#if physicsMode !== 0}
      <RangeSlider label="Gravity" bind:value={gravity} min={1} max={60} step={1} />
      <RangeSlider label="Viscosity" bind:value={viscosity} min={0} max={0.95} step={0.01} formatValue={(v) => v.toFixed(2)} />
    {/if}
  </div>

  <div class="section">
    <h3>Appearance</h3>
    <RangeSlider label="Thickness" bind:value={thickness} min={0.01} max={0.5} step={0.01} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Density" bind:value={densityScale} min={0.02} max={1.0} step={0.01} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Softness" bind:value={softness} min={0} max={1} step={0.01} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Depth" bind:value={depthScale} min={0} max={10} step={0.1} formatValue={(v) => v.toFixed(1)} />
    <RangeSlider label="Opacity" bind:value={opacity} min={0.05} max={1} step={0.05} formatValue={(v) => v.toFixed(2)} />
    <SelectInput label="Color" bind:value={useBaseColor}>
      <option value={0}>Per-stroke</option>
      <option value={1}>Uniform</option>
    </SelectInput>
    {#if useBaseColor === 1}
      <RangeSlider label="Hue" bind:value={colorHue} min={0} max={1} step={0.01} formatValue={(v) => v.toFixed(2)} />
      <RangeSlider label="Saturation" bind:value={colorSat} min={0} max={1} step={0.01} formatValue={(v) => v.toFixed(2)} />
      <RangeSlider label="Brightness" bind:value={colorVal} min={0.1} max={1} step={0.01} formatValue={(v) => v.toFixed(2)} />
    {/if}
  </div>

  <div class="section">
    <h3>Lighting</h3>
    <RangeSlider label="Shininess" bind:value={shininess} min={1} max={128} step={1} />
    <RangeSlider label="Specular" bind:value={specStrength} min={0} max={2} step={0.05} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Ambient" bind:value={ambient} min={0} max={1} step={0.05} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Light X" bind:value={lightAngleX} min={-1.5} max={1.5} step={0.05} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Light Y" bind:value={lightAngleY} min={-1.5} max={1.5} step={0.05} formatValue={(v) => v.toFixed(2)} />
    <RangeSlider label="Rim Power" bind:value={rimPower} min={0.5} max={8} step={0.1} formatValue={(v) => v.toFixed(1)} />
    <RangeSlider label="Rim Strength" bind:value={rimStrength} min={0} max={2} step={0.05} formatValue={(v) => v.toFixed(2)} />
  </div>

  <div class="section">
    <button class="reset-btn" onclick={resetDefaults}>Reset to Defaults</button>
  </div>
</SettingsPanel>

<style>
  .section {
    margin-bottom: 16px;
  }
  .section:last-child {
    margin-bottom: 0;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
  }
  .reset-btn {
    width: 100%;
    padding: 8px;
    font-size: 12px;
    color: rgba(255, 120, 120, 0.8);
    border: 1px solid rgba(255, 120, 120, 0.25);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    backdrop-filter: blur(8px);
  }
  .reset-btn:hover {
    background: rgba(255, 120, 120, 0.12);
    color: rgba(255, 140, 140, 1);
  }
</style>
