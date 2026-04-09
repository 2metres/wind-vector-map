// CRTS PUBLIC DOMAIN CRT-STYLED SCALAR by Timothy Lottes
// Adapted for Ghostty by Qwerasd. Public domain (Unlicense).
// Ported to WebGL1 with uniform-based parameters.

precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_scale;        // scanlines per pixel (default 0.33333)
uniform float u_warp;         // tube warp enable (0.0 = none, 1.0 = full)
uniform float u_minVin;       // vignette darkness (default 0.5)
uniform float u_thin;         // scanline thinness (default 0.75)
uniform float u_blur;         // horizontal blur (default -2.75)
uniform float u_mask;         // shadow mask intensity (default 0.65)
uniform float u_maskType;     // 0=shadow, 1=grille, 2=grille_lite, 3=none
uniform float u_time;         // for future VHS effects

varying vec2 v_uv;

float FromSrgb1(float c) {
  return (c <= 0.04045) ? c * (1.0 / 12.92) :
    pow(c * (1.0 / 1.055) + (0.055 / 1.055), 2.4);
}

vec3 FromSrgb(vec3 c) {
  return vec3(FromSrgb1(c.r), FromSrgb1(c.g), FromSrgb1(c.b));
}

float ToSrgb1(float c) {
  return (c < 0.0031308) ? c * 12.92 :
    1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 ToSrgb(vec3 c) {
  return vec3(ToSrgb1(c.r), ToSrgb1(c.g), ToSrgb1(c.b));
}

vec3 CrtsFetch(vec2 uv) {
  return FromSrgb(texture2D(u_texture, uv.xy).rgb);
}

float CrtsMax3F1(float a, float b, float c) {
  return max(a, max(b, c));
}

// Returns tone curve parameters (ab) based on scanline thinness and mask.
// Handles mask type adjustments:
//   grille_lite: mask effectively = 0.5 + mask * 0.5
//   none:        mask effectively = 1.0
vec2 CrtsTone(float thin, float mask) {
  float m = mask;
  if (u_maskType > 2.5) {
    // none
    m = 1.0;
  } else if (u_maskType > 1.5) {
    // grille_lite
    m = 0.5 + mask * 0.5;
  }
  vec2 ret;
  float midOut = 0.18 / ((1.5 - thin) * (0.5 * m + 0.5));
  float pMidIn = 0.18;
  ret.x = ((-pMidIn) + midOut) / ((1.0 - pMidIn) * midOut);
  ret.y = ((-pMidIn) * midOut + pMidIn) / (midOut * (-pMidIn) + midOut);
  return ret;
}

// Shadow/phosphor mask. Returns per-pixel RGB darkening mask.
// maskType: 0=shadow, 1=grille, 2=grille_lite, 3=none
vec3 CrtsMask(vec2 pos, float dark) {
  vec3 m;
  if (u_maskType > 2.5) {
    // none
    return vec3(1.0);
  } else if (u_maskType > 1.5) {
    // grille_lite: bright background, one dark channel
    float x = fract(pos.x * (1.0 / 3.0));
    m = vec3(1.0, 1.0, 1.0);
    if (x < (1.0 / 3.0)) m.r = dark;
    else if (x < (2.0 / 3.0)) m.g = dark;
    else m.b = dark;
    return m;
  } else if (u_maskType > 0.5) {
    // grille: dark background, one bright channel
    float x = fract(pos.x * (1.0 / 3.0));
    m = vec3(dark, dark, dark);
    if (x < (1.0 / 3.0)) m.r = 1.0;
    else if (x < (2.0 / 3.0)) m.g = 1.0;
    else m.b = 1.0;
    return m;
  } else {
    // shadow: offset rows, 1/6 period RGB
    vec2 p = pos;
    p.x += p.y * 3.0;
    m = vec3(dark, dark, dark);
    float x = fract(p.x * (1.0 / 6.0));
    if (x < (1.0 / 3.0)) m.r = 1.0;
    else if (x < (2.0 / 3.0)) m.g = 1.0;
    else m.b = 1.0;
    return m;
  }
}

// Main CRT filter:
//   fragCoord  — pixel coordinate
//   inputSizeMul — typically vec2(1.0)
//   inputSizeHalf — inputSize * 0.5
//   inputSizeRcp — 1.0 / inputSize
//   outputSizeRcp — 1.0 / outputSize
//   outputSize2Rcp — 2.0 / outputSize
//   outputSizeY — outputSize.y
//   warp — barrel warp amount per axis (x=horiz, y=vert)
//   thin — scanline thinness
//   blur — horizontal blur strength
//   mask — shadow mask intensity
//   tone — precomputed tone curve (from CrtsTone)
vec3 CrtsFilter(
  vec2 fragCoord,
  vec2 inputSizeMul,
  vec2 inputSizeHalf,
  vec2 inputSizeRcp,
  vec2 outputSizeRcp,
  vec2 outputSize2Rcp,
  float outputSizeY,
  vec2 warp,
  float thin,
  float blur,
  float mask,
  vec2 tone
) {
  // Normalized position in [-1, 1]
  vec2 pos = fragCoord * outputSize2Rcp - vec2(1.0);

  // Barrel distortion (controlled by u_warp as a multiplier)
  vec2 dist = pos * pos;
  pos *= 1.0 + (dist.yx * warp) * u_warp;

  // Convert back to UV in [0, 1]
  vec2 uv = pos * 0.5 + vec2(0.5);

  // Vignette: darken edges. u_minVin controls max darkness.
  float vin = u_minVin + (1.0 - u_minVin) * clamp(
    (1.0 - (1.0 - abs(pos.x)) * (1.0 - abs(pos.y))) * 2.0,
    0.0, 1.0
  );
  vin = clamp(vin, 0.0, 1.0);

  // Scanlines: vertical cosine wave
  float srcY = uv.y * inputSizeHalf.y * 2.0;
  float off = floor(srcY) * inputSizeRcp.y;
  float py = srcY - floor(srcY);
  // Scanline weight: thinner = harder falloff
  float scan0 = clamp((thin * 2.0 + 2.0) * (1.0 - 2.0 * abs(py - 0.5)), 0.0, 1.0);
  float scan1 = clamp((thin * 2.0 + 2.0) * (1.0 - 2.0 * abs(py + 0.5 - 1.0)), 0.0, 1.0);

  // UV for top and bottom scanline rows
  vec2 uv0 = vec2(uv.x, off + inputSizeRcp.y * 0.5);
  vec2 uv1 = vec2(uv.x, off + inputSizeRcp.y * 1.5);

  // Horizontal gaussian blur: 4 taps with blur offset
  float blurOffset = blur * inputSizeRcp.x;
  vec3 color =
    CrtsFetch(vec2(uv0.x - blurOffset, uv0.y)) * scan0 +
    CrtsFetch(vec2(uv0.x,              uv0.y)) * scan0 +
    CrtsFetch(vec2(uv0.x + blurOffset, uv0.y)) * scan0 +
    CrtsFetch(vec2(uv1.x - blurOffset, uv1.y)) * scan1 +
    CrtsFetch(vec2(uv1.x,              uv1.y)) * scan1 +
    CrtsFetch(vec2(uv1.x + blurOffset, uv1.y)) * scan1;
  color *= (1.0 / 3.0) * (0.5 / (scan0 + scan1 + 0.0001));

  // Phosphor mask
  vec3 msk = CrtsMask(fragCoord, mask);
  color *= msk;

  // Tonal curve: c = c * (a*c + b)^-1  (approximate gamma/exposure)
  float peak = CrtsMax3F1(color.r, color.g, color.b);
  peak = max(peak, 0.0001);
  float peakT = peak * (tone.x * peak + tone.y);
  color *= (peakT / peak) * vin;

  return color;
}

void main() {
  vec2 fragCoord = v_uv * u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 inputSize = u_resolution * u_scale;

  vec3 color = CrtsFilter(
    fragCoord,
    vec2(1.0),
    inputSize * 0.5,
    1.0 / inputSize,
    1.0 / u_resolution,
    2.0 / u_resolution,
    u_resolution.y,
    vec2(1.0 / (50.0 * aspect), 1.0 / 50.0),
    u_thin,
    u_blur,
    u_mask,
    CrtsTone(u_thin, u_mask)
  );

  gl_FragColor = vec4(ToSrgb(color), 1.0);
}
