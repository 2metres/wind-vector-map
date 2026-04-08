import type { ShaderProgram } from "./types";

export function createQuadVBO(gl: WebGLRenderingContext): WebGLBuffer {
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  return vbo;
}

export function drawQuad(
  gl: WebGLRenderingContext,
  program: ShaderProgram,
  vbo: WebGLBuffer,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const loc = program.attributes["a_position"];
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
