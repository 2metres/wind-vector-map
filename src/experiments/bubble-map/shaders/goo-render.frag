precision mediump float;

uniform sampler2D u_density;     // density FBO: R=density, G=density*hue, A=density
uniform vec2 u_resolution;       // canvas size in pixels
uniform float u_threshold;       // density cutoff for goo surface
uniform float u_shininess;       // specular exponent
uniform vec3 u_lightDir;         // normalized light direction
uniform float u_ambient;         // ambient light level
uniform float u_specStrength;    // specular intensity
uniform float u_rimPower;        // rim lighting falloff
uniform float u_rimStrength;     // rim lighting intensity
uniform float u_opacity;         // global opacity multiplier
uniform float u_baseHue;         // base color hue override
uniform float u_baseSat;         // base color saturation override
uniform float u_baseVal;         // base color value override
uniform float u_useBaseColor;    // 0=per-stroke hue, 1=base color

varying vec2 v_uv;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h, s, v);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec2 texel = 1.0 / u_resolution;

  // Sample density at current pixel and neighbors for gradient
  float dc = texture2D(u_density, v_uv).r;
  float dl = texture2D(u_density, v_uv - vec2(texel.x, 0.0)).r;
  float dr = texture2D(u_density, v_uv + vec2(texel.x, 0.0)).r;
  float db = texture2D(u_density, v_uv - vec2(0.0, texel.y)).r;
  float dt = texture2D(u_density, v_uv + vec2(0.0, texel.y)).r;

  // Extract hue from weighted average
  vec4 samp = texture2D(u_density, v_uv);
  float strokeHue = samp.r > 0.001 ? samp.g / samp.r : 0.5;
  // Mix between per-stroke hue and base color
  float hue = mix(strokeHue, u_baseHue, u_useBaseColor);
  float sat = mix(0.7, u_baseSat, u_useBaseColor);
  float val = mix(0.9, u_baseVal, u_useBaseColor);

  if (dc < u_threshold) {
    // Edge glow: soft falloff near the threshold
    float edgeDist = dc / u_threshold;
    float glow = smoothstep(0.0, 1.0, edgeDist) * 0.15;
    if (glow < 0.01) discard;

    vec3 glowColor = hsv2rgb(hue, sat * 0.85, val);
    gl_FragColor = vec4(glowColor * glow, glow * u_opacity);
    return;
  }

  // Compute surface normal from density gradient
  float dzdx = (dr - dl) * 0.5;
  float dzdy = (dt - db) * 0.5;
  vec3 normal = normalize(vec3(-dzdx * 4.0, -dzdy * 4.0, 1.0));

  // Base color
  vec3 baseColor = hsv2rgb(hue, sat, val);

  // Phong lighting
  vec3 L = normalize(u_lightDir);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-L, normal);

  float diffuse = max(dot(normal, L), 0.0);
  float spec = pow(max(dot(R, V), 0.0), u_shininess);

  // Rim lighting
  float rim = 1.0 - max(dot(normal, V), 0.0);
  rim = pow(rim, u_rimPower) * u_rimStrength;

  // Height-based shading: thicker = darker/richer
  float height = smoothstep(u_threshold, u_threshold + 1.5, dc);
  vec3 deepColor = hsv2rgb(hue, min(sat + 0.15, 1.0), val * 0.55);
  vec3 surfaceColor = mix(baseColor, deepColor, height * 0.4);

  // Combine lighting
  vec3 color = surfaceColor * (u_ambient + diffuse * 0.7)
             + vec3(1.0) * spec * u_specStrength
             + surfaceColor * rim;

  // Soft edge anti-aliasing
  float alpha = smoothstep(u_threshold, u_threshold + 0.05, dc) * u_opacity;

  gl_FragColor = vec4(color, alpha);
}
