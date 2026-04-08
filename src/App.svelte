<script lang="ts">
  import { onMount } from "svelte";
  import { AudioCapture, CameraCapture, WindSimulation } from "./lib";

  let canvas: HTMLCanvasElement;
  let sim: WindSimulation;
  let audio: AudioCapture;
  let camera: CameraCapture;
  let animFrameId: number;
  let micEnabled = $state(false);
  let cameraEnabled = $state(false);
  let panelOpen = $state(false);
  let drawing = false;
  let fullscreen = $state(false);
  let renderMode = $state(0);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      fullscreen = true;
    } else {
      document.exitFullscreen();
      fullscreen = false;
    }
  }

  // Settings — odd-range ones use 0–1 sliders mapped to real values
  let cameraStrength = $state(25);
  let audioBoostMin = $state(0.05);
  let audioBoostMax = $state(8);
  let velocityDecay = $state(0.99);
  let cameraVelocityDecay = $state(0.9);
  let triggerDecay = $state(0.999);
  let diffusion = $state(0.15);
  let motionThreshold = $state(2);

  onMount(() => {
    sim = new WindSimulation(canvas);
    audio = new AudioCapture();
    camera = new CameraCapture();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) sim.resize(width, height);
      }
    });
    ro.observe(canvas.parentElement!);
    sim.resize(window.innerWidth, window.innerHeight);

    let lastTime = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Sync settings
      sim.settings.cameraStrength = cameraStrength;
      sim.settings.audioBoostMin = audioBoostMin;
      sim.settings.audioBoostMax = audioBoostMax;
      sim.settings.velocityDecay = velocityDecay;
      sim.settings.cameraVelocityDecay = cameraVelocityDecay;
      sim.settings.triggerDecay = triggerDecay;
      sim.settings.diffusion = diffusion;
      sim.settings.motionThreshold = motionThreshold;
      sim.renderMode = Number(renderMode);

      if (audio.isActive) sim.setAudioHistory(audio.updateHistory());
      if (camera.ready) sim.setCameraFrame(camera.videoElement!);
      sim.update(dt);
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);

    const onFsChange = () => {
      fullscreen = !!document.fullscreenElement;
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      cancelAnimationFrame(animFrameId);
      ro.disconnect();
      audio.destroy();
      camera.destroy();
      sim.destroy();
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  });

  async function enableMediaDevices() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user", width: 640, height: 480 },
      });
      const micOk = await audio.start(stream);
      micEnabled = micOk;
      const camOk = await camera.start(stream);
      cameraEnabled = camOk;
    } catch (e) {
      console.warn("Media access denied or unavailable:", e);
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest(".panel")) return;
    drawing = true;
    sim?.startNewStroke();
    sim?.onMouseMove(e.clientX, e.clientY);
  }

  function handleMouseMove(e: MouseEvent) {
    if (drawing) {
      sim?.onMouseMove(e.clientX, e.clientY);
    }
  }

  function handleMouseUp() {
    if (drawing) {
      drawing = false;
    }
  }

  function handleMouseLeave() {
    if (drawing) {
      drawing = false;
    }
    sim?.onMouseLeave();
  }

  function handleTouchStart(e: TouchEvent) {
    if ((e.target as HTMLElement).closest(".panel")) return;
    e.preventDefault();
    drawing = true;
    sim?.startNewStroke();
    const touch = e.touches[0];
    sim?.onMouseMove(touch.clientX, touch.clientY);
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (drawing) {
      const touch = e.touches[0];
      sim?.onMouseMove(touch.clientX, touch.clientY);
    }
  }

  function handleTouchEnd() {
    if (drawing) {
      drawing = false;
    }
    sim?.onMouseLeave();
  }
</script>

<canvas
  bind:this={canvas}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseLeave}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
></canvas>

{#if !fullscreen}
  <div class="controls">
    {#if !micEnabled || !cameraEnabled}
      <button class="ctrl-btn" onclick={enableMediaDevices}>Enable Mic & Camera</button>
    {/if}
    <button class="ctrl-btn" onclick={() => (panelOpen = !panelOpen)}>
      {panelOpen ? "Close" : "Settings"}
    </button>
    <button class="ctrl-btn" onclick={toggleFullscreen}>Fullscreen</button>
  </div>
{/if}

{#if panelOpen && !fullscreen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel" onmousedown={(e) => e.stopPropagation()}>
    <div class="panel-section">
      <h3>Camera</h3>
      <label>
        <span>Strength <code>{cameraStrength.toFixed(0)}</code></span>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          bind:value={cameraStrength}
        />
      </label>
      <label>
        <span>Audio Boost Min <code>{audioBoostMin.toFixed(2)}</code></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={audioBoostMin}
        />
      </label>
      <label>
        <span>Audio Boost Max <code>{audioBoostMax.toFixed(1)}</code></span>
        <input
          type="range"
          min="1"
          max="30"
          step="0.5"
          bind:value={audioBoostMax}
        />
      </label>
      <label>
        <span>Noise Filter <code>{motionThreshold}</code></span>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          bind:value={motionThreshold}
        />
      </label>
    </div>

    <div class="panel-section">
      <h3>Velocity</h3>
      <label>
        <span>Decay <code>{velocityDecay.toFixed(3)}</code></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          bind:value={velocityDecay}
        />
      </label>
      <label>
        <span>Camera Decay <code>{cameraVelocityDecay.toFixed(3)}</code></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          bind:value={cameraVelocityDecay}
        />
      </label>
      <label>
        <span>Diffusion <code>{diffusion.toFixed(3)}</code></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          bind:value={diffusion}
        />
      </label>
    </div>

    <div class="panel-section">
      <h3>Triggers</h3>
      <label>
        <span>Trigger Decay <code>{triggerDecay.toFixed(4)}</code></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          bind:value={triggerDecay}
        />
      </label>
    </div>

    <div class="panel-section">
      <h3>Display</h3>
      <label>
        <span>Render Mode</span>
        <select bind:value={renderMode}>
          <option value={0}>Arrows</option>
          <option value={1}>Digits (0–9)</option>
          <option value={2}>Lines (─│╱╲)</option>
        </select>
      </label>
    </div>
  </div>
{/if}
