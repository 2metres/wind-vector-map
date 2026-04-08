import type { ShaderProgram } from "./types";

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + info);
  }
  return shader;
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
  schema: { uniforms: string[]; attributes: string[] },
): ShaderProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(program));
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of schema.uniforms)
    uniforms[name] = gl.getUniformLocation(program, name);
  const attributes: Record<string, number> = {};
  for (const name of schema.attributes)
    attributes[name] = gl.getAttribLocation(program, name);
  return { program, uniforms, attributes };
}
