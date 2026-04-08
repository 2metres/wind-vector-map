import type { FBOHandle } from "./types";

export function createFBO(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  initData?: Uint8Array,
): FBOHandle {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (initData) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      initData,
    );
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, texture };
}

export class PingPongFBOs {
  private fbos: [FBOHandle, FBOHandle];
  private index = 0;

  constructor(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    initData?: Uint8Array,
  ) {
    this.fbos = [
      createFBO(gl, width, height, initData),
      createFBO(gl, width, height, initData),
    ];
  }

  get read(): FBOHandle {
    return this.fbos[this.index];
  }

  get write(): FBOHandle {
    return this.fbos[1 - this.index];
  }

  swap(): void {
    this.index = 1 - this.index;
  }

  destroy(gl: WebGLRenderingContext): void {
    for (const { fbo, texture } of this.fbos) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
    }
  }
}
