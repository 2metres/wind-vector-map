<script lang="ts">
  import { onMount } from "svelte";
  import { CanvasContainer, createAnimationLoop } from "../../lib/canvas";
  import { CameraCapture } from "../../lib/media";
  import { ControlBar } from "../../lib/ui";

  let camera: CameraCapture;
  let canvas: HTMLCanvasElement;
  let gl: WebGLRenderingContext;
  let cameraTexture: WebGLTexture | null = null;

  function initCameraTexture(): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Initialize with a 1x1 black pixel until camera is ready
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  function uploadCameraFrame() {
    if (!camera.ready || !camera.videoElement || !cameraTexture) return;
    gl.bindTexture(gl.TEXTURE_2D, cameraTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, camera.videoElement);
  }

  const loop = createAnimationLoop((_dt) => {
    if (!gl || !camera.ready) return;
    uploadCameraFrame();
    // TODO: render fullscreen quad with CRT shader using cameraTexture
  });

  function handleCanvas(c: HTMLCanvasElement) {
    canvas = c;
    const ctx = c.getContext("webgl", { alpha: false });
    if (!ctx) throw new Error("WebGL not supported");
    gl = ctx;
    cameraTexture = initCameraTexture();
    camera = new CameraCapture();
    loop.start();
    enableCamera();
  }

  function handleResize(_width: number, _height: number) {
    if (gl) gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  onMount(() => {
    return () => {
      loop.stop();
      camera?.destroy();
      if (cameraTexture && gl) gl.deleteTexture(cameraTexture);
    };
  });

  async function enableCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      await camera.start(stream);
    } catch (e) {
      console.warn("Camera access denied:", e);
    }
  }
</script>

<CanvasContainer oncanvas={handleCanvas} onresize={handleResize} />

<ControlBar>
  <button disabled>Settings (coming soon)</button>
</ControlBar>
