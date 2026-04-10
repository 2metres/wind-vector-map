precision mediump float;

uniform sampler2D u_density;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_shininess;
uniform vec3 u_lightDir;
uniform float u_ambient;
uniform float u_specStrength;
uniform float u_rimPower;
uniform float u_rimStrength;
uniform float u_opacity;
uniform float u_baseHue;
uniform float u_baseSat;
uniform float u_baseVal;
uniform float u_useBaseColor;
uniform float u_depthScale;      // how much density above threshold maps to visual depth

varying vec2 v_uv;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h, s, v);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec2 texel = 1.0 / u_resolution;

  float dc = texture2D(u_density, v_uv).r;
  float dl = texture2D(u_density, v_uv - vec2(texel.x, 0.0)).r;
  float dr = texture2D(u_density, v_uv + vec2(texel.x, 0.0)).r;
  float db = texture2D(u_density, v_uv - vec2(0.0, texel.y)).r;
  float dt = texture2D(u_density, v_uv + vec2(0.0, texel.y)).r;

  vec4 samp = texture2D(u_density, v_uv);
  float strokeHue = samp.r > 0.001 ? samp.g / samp.r : 0.5;
  float hue = mix(strokeHue, u_baseHue, u_useBaseColor);
  float sat = mix(0.7, u_baseSat, u_useBaseColor);
  float val = mix(0.9, u_baseVal, u_useBaseColor);

  if (dc < u_threshold) {
    float edgeDist = dc / u_threshold;
    float glow = smoothstep(0.0, 1.0, edgeDist) * 0.15;
    if (glow < 0.01) discard;

    vec3 glowColor = hsv2rgb(hue, sat * 0.85, val);
    gl_FragColor = vec4(glowColor * glow, glow * u_opacity);
    return;
  }

  // Normalized depth: how far above threshold (0=surface, 1=max depth)
  float depth = smoothstep(u_threshold, 1.0, dc);

  // Compute normal — scale gradient strength by depthScale for more dramatic relief
  float dzdx = (dr - dl) * 0.5;
  float dzdy = (dt - db) * 0.5;
  float gradScale = 4.0 + depth * u_depthScale * 8.0;
  vec3 normal = normalize(vec3(-dzdx * gradScale, -dzdy * gradScale, 1.0));

  // Color: surface is bright, deep interior is richer/darker (cloud/jello look)
  vec3 surfaceColor = hsv2rgb(hue, sat, val);
  vec3 deepColor = hsv2rgb(hue, min(sat + 0.2, 1.0), val * 0.4);
  vec3 baseColor = mix(surfaceColor, deepColor, depth * 0.6);

  // Subsurface scattering fake: light passes through thin areas
  float subsurface = (1.0 - depth) * 0.3;
  vec3 sssColor = hsv2rgb(hue, sat * 0.5, 1.0) * subsurface;

  // Phong lighting
  vec3 L = normalize(u_lightDir);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-L, normal);

  float diffuse = max(dot(normal, L), 0.0);
  float spec = pow(max(dot(R, V), 0.0), u_shininess);

  // Rim lighting — stronger at edges for volume
  float rim = 1.0 - max(dot(normal, V), 0.0);
  rim = pow(rim, u_rimPower) * u_rimStrength;

  vec3 color = baseColor * (u_ambient + diffuse * 0.7)
             + sssColor
             + vec3(1.0) * spec * u_specStrength
             + baseColor * rim;

  float alpha = smoothstep(u_threshold, u_threshold + 0.02, dc) * u_opacity;

  gl_FragColor = vec4(color, alpha);
}
