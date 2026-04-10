precision mediump float;

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
uniform float u_absorption;     // Beer's law absorption multiplier
uniform float u_fresnelF0;      // Schlick F0 (0.02=water, 0.04=goo)
uniform float u_envBright;      // environment reflection brightness

varying vec2 v_uv;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h, s, v);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// Fake environment: dark bottom, bright top gradient (like a studio HDRI)
vec3 envColor(vec3 dir) {
  float y = dir.y * 0.5 + 0.5; // -1..1 → 0..1
  vec3 sky = vec3(0.6, 0.7, 0.9);
  vec3 ground = vec3(0.05, 0.05, 0.08);
  vec3 horizon = vec3(0.3, 0.3, 0.4);
  // Blend: ground → horizon → sky
  vec3 col = y < 0.5
    ? mix(ground, horizon, y * 2.0)
    : mix(horizon, sky, (y - 0.5) * 2.0);
  return col * u_envBright;
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  vec2 step2 = texel * 2.0;

  float dc = texture2D(u_density, v_uv).r;

  // Forward and backward derivatives — pick smallest Z jump (ocean technique)
  float dl = texture2D(u_density, v_uv - vec2(step2.x, 0.0)).r;
  float dr = texture2D(u_density, v_uv + vec2(step2.x, 0.0)).r;
  float db = texture2D(u_density, v_uv - vec2(0.0, step2.y)).r;
  float dt = texture2D(u_density, v_uv + vec2(0.0, step2.y)).r;

  // Hue extraction
  vec4 samp = texture2D(u_density, v_uv);
  float strokeHue = samp.r > 0.001 ? samp.g / samp.r : 0.5;
  float hue = mix(strokeHue, u_baseHue, u_useBaseColor);
  float sat = mix(0.7, u_baseSat, u_useBaseColor);
  float val = mix(0.9, u_baseVal, u_useBaseColor);

  if (dc < u_threshold) {
    // Soft glow halo around edges
    float edgeDist = dc / u_threshold;
    float glow = smoothstep(0.0, 1.0, edgeDist) * 0.12;
    if (glow < 0.005) discard;
    vec3 glowColor = hsv2rgb(hue, sat * 0.6, val);
    gl_FragColor = vec4(glowColor * glow, glow * u_opacity);
    return;
  }

  // === Thickness (density above threshold) ===
  float thickness = dc - u_threshold;

  // === Normal from density gradient ===
  // Forward/backward derivative selection (avoids silhouette artifacts)
  float fwdX = dr - dc;
  float bwdX = dc - dl;
  float dzdx = abs(fwdX) < abs(bwdX) ? fwdX : bwdX;

  float fwdY = dt - dc;
  float bwdY = dc - db;
  float dzdy = abs(fwdY) < abs(bwdY) ? fwdY : bwdY;

  // Scale gradients for dramatic 3D normals
  float gradMag = u_depthScale * 80.0;
  vec3 normal = normalize(vec3(-dzdx * gradMag, -dzdy * gradMag, u_threshold * 2.0));

  // === View and light vectors ===
  vec3 V = vec3(0.0, 0.0, 1.0);       // view direction (screen-facing)
  vec3 L = normalize(u_lightDir);
  vec3 H = normalize(L + V);           // Blinn-Phong half-vector
  vec3 R = reflect(-V, normal);        // reflection direction for environment

  float NdotV = max(dot(normal, V), 0.0);
  float NdotL = max(dot(normal, L), 0.0);
  float NdotH = max(dot(normal, H), 0.0);

  // === Beer's Law transmittance ===
  // Thicker goo absorbs more light → deeper color
  vec3 fluidColor = hsv2rgb(hue, sat, val);
  vec3 transmittance = exp(-u_absorption * thickness * (1.0 - fluidColor));
  // Background "behind" the goo — dark surface
  vec3 bgColor = vec3(0.02, 0.02, 0.05);
  vec3 refractionColor = bgColor * transmittance + fluidColor * (1.0 - transmittance);

  // === Schlick Fresnel ===
  float fresnel = clamp(
    u_fresnelF0 + (1.0 - u_fresnelF0) * pow(1.0 - NdotV, 5.0),
    0.0, 1.0
  );

  // === Environment reflection ===
  vec3 reflectionColor = envColor(R);

  // === Specular (Blinn-Phong, tight highlight for wet look) ===
  float spec = pow(NdotH, u_shininess);

  // === Final composite (ocean-style) ===
  // Base = blend refraction and reflection via Fresnel
  vec3 color = mix(refractionColor, reflectionColor, fresnel);
  // Add specular highlight on top
  color += vec3(1.0) * spec * u_specStrength;
  // Subtle diffuse fill so surface reads in shadow areas
  color += fluidColor * NdotL * 0.1;

  float alpha = smoothstep(u_threshold, u_threshold + 0.01, dc) * u_opacity;

  gl_FragColor = vec4(color, alpha);
}
