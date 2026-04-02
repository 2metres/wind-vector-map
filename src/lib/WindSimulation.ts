import arrowsVert from '../shaders/arrows.vert?raw';
import arrowsFrag from '../shaders/arrows.frag?raw';
import velocityUpdateVert from '../shaders/velocity-update.vert?raw';
import velocityUpdateFrag from '../shaders/velocity-update.frag?raw';
import diffuseFrag from '../shaders/diffuse.frag?raw';
import { PathStore } from './PathStore';

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
}

export class WindSimulation {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;

  // Programs
  private arrowProgram!: ShaderProgram;
  private velocityProgram!: ShaderProgram;
  private diffuseProgram!: ShaderProgram;

  // Velocity field ping-pong textures
  private velocityFBOs: { fbo: WebGLFramebuffer; texture: WebGLTexture }[] = [];
  private currentVelocity = 0;

  // Grid
  private gridCols = 64;
  private gridRows = 48;
  private gridSpacing = 18;
  private fieldSize = 256;

  // Buffers
  private arrowVBO!: WebGLBuffer;
  private gridVBO!: WebGLBuffer;
  private quadVBO!: WebGLBuffer;
  private arrowVertexCount = 0;
  private gridInstanceCount = 0;

  // Mouse state
  private mousePos = [0.5, 0.5];
  private mouseVel = [0, 0];
  private mouseActive = false;
  private lastMousePos = [0.5, 0.5];
  private lastMouseTime = 0;

  // Audio
  private audioHistoryTexture!: WebGLTexture;
  private audioActive = false;

  // Path
  private pathStore = new PathStore();
  private pathMapTexture!: WebGLTexture;
  private hasPath = false;

  // Time
  private time = 0;

  // Extension
  private instancedArraysExt: ANGLE_instanced_arrays | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.instancedArraysExt = gl.getExtension('ANGLE_instanced_arrays');
    if (!this.instancedArraysExt) {
      throw new Error('ANGLE_instanced_arrays not supported');
    }

    this.init();
  }

  private init() {
    const gl = this.gl;

    this.arrowProgram = this.createProgram(arrowsVert, arrowsFrag, {
      uniforms: ['u_resolution', 'u_velocityField', 'u_pathMap', 'u_audioHistory', 'u_audioActive', 'u_hasPath', 'u_time', 'u_arrowScale', 'u_cellSize'],
      attributes: ['a_position', 'a_vertex'],
    });

    this.velocityProgram = this.createProgram(velocityUpdateVert, velocityUpdateFrag, {
      uniforms: ['u_prevVelocity', 'u_mousePos', 'u_mouseVel', 'u_mouseActive', 'u_decay', 'u_radius', 'u_dt'],
      attributes: ['a_position'],
    });

    this.diffuseProgram = this.createProgram(velocityUpdateVert, diffuseFrag, {
      uniforms: ['u_velocity', 'u_texelSize', 'u_diffusion'],
      attributes: ['a_position'],
    });

    // Velocity FBOs
    const initSize = this.fieldSize * this.fieldSize * 4;
    const initData = new Uint8Array(initSize);
    for (let i = 0; i < initSize; i += 4) {
      initData[i] = 128;
      initData[i + 1] = 128;
      initData[i + 2] = 0;
      initData[i + 3] = 255;
    }
    for (let i = 0; i < 2; i++) {
      this.velocityFBOs.push(this.createFBO(this.fieldSize, this.fieldSize, initData));
    }

    // Path map texture
    this.pathMapTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.pathMapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fieldSize, this.fieldSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Audio history texture (256x1, LUMINANCE)
    this.audioHistoryTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.audioHistoryTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.createArrowGeometry();
    this.createGridPositions();

    this.quadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private createArrowGeometry() {
    const gl = this.gl;
    const vertices = new Float32Array([
      0.5, 0.0, -0.5, 0.22, -0.25, 0.0,
      0.5, 0.0, -0.25, 0.0, -0.5, -0.22,
    ]);
    this.arrowVertexCount = 6;
    this.arrowVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  private createGridPositions() {
    const gl = this.gl;
    const positions: number[] = [];
    for (let y = 0; y < this.gridRows; y++) {
      for (let x = 0; x < this.gridCols; x++) {
        const px = ((x + 0.5) / this.gridCols) * 2.0 - 1.0;
        const py = ((y + 0.5) / this.gridRows) * 2.0 - 1.0;
        positions.push(px, py);
      }
    }
    this.gridInstanceCount = this.gridCols * this.gridRows;
    this.gridVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  }

  private createProgram(vertSrc: string, fragSrc: string, schema: { uniforms: string[]; attributes: string[] }): ShaderProgram {
    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of schema.uniforms) uniforms[name] = gl.getUniformLocation(program, name);
    const attributes: Record<string, number> = {};
    for (const name of schema.attributes) attributes[name] = gl.getAttribLocation(program, name);
    return { program, uniforms, attributes };
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    return shader;
  }

  private createFBO(width: number, height: number, initData?: Uint8Array) {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (initData) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initData);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture };
  }

  private swapVelocity() { this.currentVelocity = 1 - this.currentVelocity; }
  private get readVelocity() { return this.velocityFBOs[this.currentVelocity]; }
  private get writeVelocity() { return this.velocityFBOs[1 - this.currentVelocity]; }

  // --- Public API ---

  onMouseMove(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = (x - rect.left) / rect.width;
    const ny = 1.0 - (y - rect.top) / rect.height;

    const now = performance.now();
    const dt = Math.max(now - this.lastMouseTime, 1) / 1000;

    if (this.mouseActive) {
      this.mouseVel[0] = (nx - this.lastMousePos[0]) / dt;
      this.mouseVel[1] = (ny - this.lastMousePos[1]) / dt;
    }

    // Record path point and live-bake the path map
    const prevLen = this.pathStore.length;
    this.pathStore.addPoint(nx, ny);
    if (this.pathStore.length > prevLen && this.pathStore.length >= 3) {
      this.liveBakePath();
    }

    this.mousePos[0] = nx;
    this.mousePos[1] = ny;
    this.lastMousePos[0] = nx;
    this.lastMousePos[1] = ny;
    this.lastMouseTime = now;
    this.mouseActive = true;
  }

  onMouseLeave() {
    this.mouseActive = false;
    this.mouseVel[0] = 0;
    this.mouseVel[1] = 0;
    this.finalizePath();
  }

  onMouseUp() {
    this.finalizePath();
  }

  private finalizePath() {
    if (this.pathStore.length < 3) return;
    this.pathStore.finalize();
    this.bakePath();
    this.hasPath = true;
  }

  clearPath() {
    this.pathStore.clear();
    this.hasPath = false;
    // Clear the path map texture
    const gl = this.gl;
    const emptyData = new Uint8Array(this.fieldSize * this.fieldSize * 4);
    gl.bindTexture(gl.TEXTURE_2D, this.pathMapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fieldSize, this.fieldSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);
  }

  startNewPath() {
    this.pathStore.clear();
    this.hasPath = false;
  }

  private liveBakePath() {
    // Temporarily normalize t values for baking, then restore
    const points = this.pathStore.points;
    const totalT = points[points.length - 1].t;
    if (totalT <= 0) return;
    // Save raw t values and normalize
    const rawT = points.map(p => p.t);
    for (const p of points) p.t /= totalT;
    this.bakePath();
    this.hasPath = true;
    // Restore raw cumulative distances
    for (let i = 0; i < points.length; i++) points[i].t = rawT[i];
  }

  private bakePath() {
    const gl = this.gl;
    const data = this.pathStore.bakePathMap(this.fieldSize, this.fieldSize, 0.12);
    gl.bindTexture(gl.TEXTURE_2D, this.pathMapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.fieldSize, this.fieldSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  setAudioHistory(data: Uint8Array) {
    const gl = this.gl;
    this.audioActive = true;
    gl.bindTexture(gl.TEXTURE_2D, this.audioHistoryTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    const cols = Math.max(4, Math.round(width / this.gridSpacing));
    const rows = Math.max(4, Math.round(height / this.gridSpacing));
    if (cols !== this.gridCols || rows !== this.gridRows) {
      this.gridCols = cols;
      this.gridRows = rows;
      this.createGridPositions();
    }
  }

  update(dt: number) {
    const gl = this.gl;
    const ext = this.instancedArraysExt!;

    this.time += dt;

    // --- Step 1: Update velocity field ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeVelocity.fbo);
    gl.viewport(0, 0, this.fieldSize, this.fieldSize);
    gl.disable(gl.BLEND);

    gl.useProgram(this.velocityProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readVelocity.texture);
    gl.uniform1i(this.velocityProgram.uniforms.u_prevVelocity, 0);
    gl.uniform2f(this.velocityProgram.uniforms.u_mousePos, this.mousePos[0], this.mousePos[1]);
    gl.uniform2f(this.velocityProgram.uniforms.u_mouseVel, this.mouseVel[0], this.mouseVel[1]);
    gl.uniform1f(this.velocityProgram.uniforms.u_mouseActive, this.mouseActive ? 1.0 : 0.0);
    gl.uniform1f(this.velocityProgram.uniforms.u_decay, 0.99);
    gl.uniform1f(this.velocityProgram.uniforms.u_radius, 0.04);
    gl.uniform1f(this.velocityProgram.uniforms.u_dt, Math.min(dt, 0.05));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.enableVertexAttribArray(this.velocityProgram.attributes.a_position);
    gl.vertexAttribPointer(this.velocityProgram.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapVelocity();

    // --- Step 2: Diffuse velocity ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeVelocity.fbo);
    gl.useProgram(this.diffuseProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readVelocity.texture);
    gl.uniform1i(this.diffuseProgram.uniforms.u_velocity, 0);
    gl.uniform2f(this.diffuseProgram.uniforms.u_texelSize, 1.0 / this.fieldSize, 1.0 / this.fieldSize);
    gl.uniform1f(this.diffuseProgram.uniforms.u_diffusion, 0.15);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.enableVertexAttribArray(this.diffuseProgram.attributes.a_position);
    gl.vertexAttribPointer(this.diffuseProgram.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapVelocity();

    // --- Step 3: Render arrows ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.02, 0.02, 0.06, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);

    gl.useProgram(this.arrowProgram.program);

    // Texture unit 0: velocity field
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readVelocity.texture);
    gl.uniform1i(this.arrowProgram.uniforms.u_velocityField, 0);

    // Texture unit 1: path map
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pathMapTexture);
    gl.uniform1i(this.arrowProgram.uniforms.u_pathMap, 1);

    // Texture unit 2: audio history
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.audioHistoryTexture);
    gl.uniform1i(this.arrowProgram.uniforms.u_audioHistory, 2);

    gl.uniform1f(this.arrowProgram.uniforms.u_audioActive, this.audioActive ? 1.0 : 0.0);
    gl.uniform1f(this.arrowProgram.uniforms.u_hasPath, this.hasPath ? 1.0 : 0.0);
    gl.uniform1f(this.arrowProgram.uniforms.u_time, this.time);
    gl.uniform2f(this.arrowProgram.uniforms.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.arrowProgram.uniforms.u_arrowScale, 1.2);
    gl.uniform2f(this.arrowProgram.uniforms.u_cellSize, 2.0 / this.gridCols, 2.0 / this.gridRows);

    // Wedge geometry (per-vertex)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowVBO);
    gl.enableVertexAttribArray(this.arrowProgram.attributes.a_vertex);
    gl.vertexAttribPointer(this.arrowProgram.attributes.a_vertex, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(this.arrowProgram.attributes.a_vertex, 0);

    // Grid positions (per-instance)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVBO);
    gl.enableVertexAttribArray(this.arrowProgram.attributes.a_position);
    gl.vertexAttribPointer(this.arrowProgram.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(this.arrowProgram.attributes.a_position, 1);

    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, this.arrowVertexCount, this.gridInstanceCount);
    ext.vertexAttribDivisorANGLE(this.arrowProgram.attributes.a_position, 0);

    // Deactivate mouse if it hasn't moved recently
    const timeSinceMove = (performance.now() - this.lastMouseTime) / 1000;
    if (timeSinceMove > 0.05) {
      this.mouseActive = false;
      this.mouseVel[0] = 0;
      this.mouseVel[1] = 0;
    }
  }

  destroy() {
    const gl = this.gl;
    for (const { fbo, texture } of this.velocityFBOs) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
    }
    gl.deleteTexture(this.pathMapTexture);
    gl.deleteTexture(this.audioHistoryTexture);
    gl.deleteBuffer(this.arrowVBO);
    gl.deleteBuffer(this.gridVBO);
    gl.deleteBuffer(this.quadVBO);
    gl.deleteProgram(this.arrowProgram.program);
    gl.deleteProgram(this.velocityProgram.program);
    gl.deleteProgram(this.diffuseProgram.program);
  }
}
