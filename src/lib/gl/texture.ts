export interface TextureOpts {
  data?: ArrayBufferView | null;
  format?: number;
  type?: number;
  filter?: number;
  wrap?: number;
}

export function createTexture(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  opts: TextureOpts = {},
): WebGLTexture {
  const format = opts.format ?? gl.RGBA;
  const type = opts.type ?? gl.UNSIGNED_BYTE;
  const filter = opts.filter ?? gl.LINEAR;
  const wrap = opts.wrap ?? gl.CLAMP_TO_EDGE;
  const data = opts.data !== undefined ? opts.data : null;

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    format,
    width,
    height,
    0,
    format,
    type,
    data,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createDataTexture(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  data: ArrayBufferView,
): WebGLTexture {
  return createTexture(gl, width, height, { data });
}
