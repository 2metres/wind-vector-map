export interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
}

export interface FBOHandle {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
}
