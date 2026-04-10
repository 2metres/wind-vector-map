precision highp float;

uniform float u_densityScale;    // per-bubble contribution (lower = more stacking depth)
uniform float u_softness;        // 0=sharp bubbles, 1=soft clouds

varying vec2 v_local;
varying float v_hue;

void main() {
  float r2 = dot(v_local, v_local);
  if (r2 > 1.0) discard;

  float d = 1.0 - r2;

  // Mix between sharp (d^3) and soft (d) falloff
  float sharp = d * d * d;
  float soft = d;
  float density = mix(sharp, soft, u_softness) * u_densityScale;

  gl_FragColor = vec4(density, density * v_hue, 0.0, density);
}
