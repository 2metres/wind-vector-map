precision highp float;

varying float v_speed;
varying float v_angle;
varying float v_proximity;

const float PI = 3.14159265359;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    if (v_speed < 0.04) discard;

    float hue = (v_angle + PI) / (2.0 * PI);
    vec3 color = hsv2rgb(vec3(hue, 0.85, 0.95));

    gl_FragColor = vec4(color, 1.0);
}
