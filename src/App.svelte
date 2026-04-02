<script lang="ts">
  import { onMount } from 'svelte';
  import { WindSimulation } from './lib/WindSimulation';
  import { AudioCapture } from './lib/AudioCapture';

  let canvas: HTMLCanvasElement;
  let sim: WindSimulation;
  let audio: AudioCapture;
  let animFrameId: number;
  let micEnabled = $state(false);
  let drawing = false;

  onMount(() => {
    sim = new WindSimulation(canvas);
    audio = new AudioCapture();

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
      if (audio.isActive) sim.setAudioHistory(audio.updateHistory());
      sim.update(dt);
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId);
      ro.disconnect();
      audio.destroy();
      sim.destroy();
    };
  });

  async function enableMic() {
    const ok = await audio.start();
    micEnabled = ok;
  }

  function handleMouseDown(e: MouseEvent) {
    drawing = true;
    sim?.startNewPath();
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
      sim?.onMouseUp();
    }
  }

  function handleMouseLeave() {
    if (drawing) {
      drawing = false;
      sim?.onMouseUp();
    }
    sim?.onMouseLeave();
  }

  function handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    drawing = true;
    sim?.startNewPath();
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
      sim?.onMouseUp();
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

{#if !micEnabled}
  <button class="mic-btn" onclick={enableMic}>
    Enable Mic
  </button>
{/if}

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #020206;
  }

  canvas {
    display: block;
    cursor: crosshair;
  }

  .mic-btn {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    padding: 10px 24px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 0.2s, color 0.2s;
  }

  .mic-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
</style>
