precision highp float;

uniform sampler2D u_density;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_shininess;
uniform vec3 u_lightDir;
uniform float u_specStrength;
uniform float u_opacity;
uniform float u_baseHue;
uniform float u_baseSat;
uniform float u_baseVal;
uniform float u_useBaseColor;
uniform float u_depthScale;
uniform float u_absorption;
uniform float u_fresnelF0;
uniform float u_envBright;

varying vec2 v_uv;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h, s, v);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Fake HDRI environment — warm top, cool bottom, bright horizon
vec3 envColor(vec3 dir) {
  float y = dir.y * 0.5 + 0.5;
  vec3 sky = vec3(0.8, 0.85, 1.0);
  vec3 horizon = vec3(1.0, 0.95, 0.85);
  vec3 ground = vec3(0.08, 0.06, 0.12);
  vec3 col = y < 0.45
    ? mix(ground, horizon, smoothstep(0.0, 0.45, y))
    : mix(horizon, sky, smoothstep(0.45, 1.0, y));
  // Bright band at horizon for glassy reflections
  col += vec3(0.4, 0.35, 0.3) * exp(-pow((y - 0.45) * 8.0, 2.0));
  return col * u_envBright;
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec2 step2 = texel * 2.0;

  // Float texture — values can be >> 1.0
  float dc = texture2D(u_density, v_uv).r;

  // Forward/backward derivatives for clean silhouette normals
  float dl = texture2D(u_density, v_uv - vec2(step2.x, 0.0)).r;
  float dr = texture2D(u_density, v_uv + vec2(step2.x, 0.0)).r;
  float db = texture2D(u_density, v_uv - vec2(0.0, step2.y)).r;
  float dt = texture2D(u_density, v_uv + vec2(0.0, step2.y)).r;

  // Hue from weighted average
  vec4 samp = texture2D(u_density, v_uv);
  float strokeHue = samp.r > 0.001 ? samp.g / samp.r : 0.5;
  float hue = mix(strokeHue, u_baseHue, u_useBaseColor);
  float sat = mix(0.7, u_baseSat, u_useBaseColor);
  float val = mix(0.9, u_baseVal, u_useBaseColor);

  if (dc < u_threshold) {
    // Glow halo
    float edgeDist = dc / u_threshold;
    float glow = smoothstep(0.0, 1.0, edgeDist) * 0.15;
    if (glow < 0.005) discard;
    vec3 glowColor = hsv2rgb(hue, sat * 0.7, val);
    gl_FragColor = vec4(glowColor * glow, glow * u_opacity);
    return;
  }

  // === Thickness: how much fluid the ray passes through ===
  float thickness = dc - u_threshold;

  // === Normal from density gradient ===
  float fwdX = dr - dc;
  float bwdX = dc - dl;
  float dzdx = abs(fwdX) < abs(bwdX) ? fwdX : bwdX;

  float fwdY = dt - dc;
  float bwdY = dc - db;
  float dzdy = abs(fwdY) < abs(bwdY) ? fwdY : bwdY;

  // Strong normals — this is what makes the 3D pop
  float gradMag = u_depthScale * 15.0;
  vec3 normal = normalize(vec3(-dzdx * gradMag, -dzdy * gradMag, 0.3));

  // === Vectors ===
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(u_lightDir);
  vec3 H = normalize(L + V);
  vec3 R = reflect(-V, normal);

  float NdotV = max(dot(normal, V), 0.0);
  float NdotL = max(dot(normal, L), 0.0);
  float NdotH = max(dot(normal, H), 0.0);

  // === Beer's Law: colored absorption through thickness ===
  vec3 fluidColor = hsv2rgb(hue, sat, val);
  // Transmittance: thicker = more absorption = richer color
  vec3 transmittance = exp(-u_absorption * thickness * (vec3(1.0) - fluidColor));
  vec3 bgColor = vec3(0.02, 0.02, 0.05);
  // What you see "through" the fluid
  vec3 refractionColor = bgColor * transmittance + fluidColor * (vec3(1.0) - transmittance);

  // === Schlick Fresnel ===
  float fresnel = u_fresnelF0 + (1.0 - u_fresnelF0) * pow(1.0 - NdotV, 5.0);
  fresnel = clamp(fresnel, 0.0, 1.0);

  // === Environment reflection ===
  vec3 reflectionColor = envColor(R);

  // === Specular: tight wet highlight ===
  float spec = pow(NdotH, u_shininess);
  // Secondary broader specular for glassy sheen
  float spec2 = pow(NdotH, u_shininess * 0.15) * 0.15;

  // === Subsurface: light shining through thin areas (blown glass effect) ===
  float sssThickness = 1.0 / (1.0 + thickness * 2.0);
  vec3 sssColor = fluidColor * sssThickness * 0.5;
  // Backlit effect: light from behind scatters through
  float backlit = max(dot(normal, -L), 0.0);
  sssColor += fluidColor * backlit * sssThickness * 0.3;

  // === Final composite ===
  // Base: Fresnel blend between seeing through (refraction) and reflection
  vec3 color = mix(refractionColor, reflectionColor, fresnel);
  // Subsurface glow
  color += sssColor;
  // Specular highlights on top
  color += vec3(1.0) * (spec * u_specStrength + spec2);
  // Subtle diffuse for shape readability
  color += fluidColor * NdotL * 0.08;

  float alpha = smoothstep(u_threshold, u_threshold * 1.2, dc) * u_opacity;

  gl_FragColor = vec4(color, alpha);
}
