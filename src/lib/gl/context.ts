export function getWebGLContext(
  canvas: HTMLCanvasElement,
  opts?: WebGLContextAttributes,
): WebGLRenderingContext {
  const gl = canvas.getContext("webgl", opts);
  if (!gl) throw new Error("WebGL not supported");
  return gl;
}

export function getExtension<T>(gl: WebGLRenderingContext, name: string): T {
  const ext = gl.getExtension(name);
  if (!ext) throw new Error(`${name} not supported`);
  return ext as T;
}
