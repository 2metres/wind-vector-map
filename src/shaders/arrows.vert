precision highp float;

attribute vec2 a_position;    // grid position (-1..1)
attribute vec2 a_vertex;      // wedge geometry vertex

uniform vec2 u_resolution;
uniform sampler2D u_velocityField;
uniform sampler2D u_triggerMap;
uniform sampler2D u_audioHistory;  // 256x1 luminance: rolling delta history
uniform float u_audioActive;
uniform float u_hasTriggers;
uniform float u_maxSequenceIndex;
uniform float u_time;
uniform float u_arrowScale;
uniform vec2 u_cellSize;

varying float v_speed;
varying float v_angle;

const float PI = 3.14159265359;

void main() {
    vec2 uv = a_position * 0.5 + 0.5;

    // Sample trigger map: R=seq high, G=seq low, B=angle, A=armed(255) or 0
    vec4 triggerInfo = texture2D(u_triggerMap, uv);
    float armed = step(0.5, triggerInfo.a);

    // Decode direction from angle byte
    float dirAngle = triggerInfo.b * 2.0 * PI - PI;
    vec2 triggerDir = vec2(cos(dirAngle), sin(dirAngle));

    // Sample velocity field
    vec4 vel = texture2D(u_velocityField, uv);
    vec2 velocity = vel.xy * 2.0 - 1.0;

    float speed = length(velocity);
    speed = speed < 0.04 ? 0.0 : speed;
    float angle = atan(velocity.y, velocity.x);

    // Audio drives arrow size on triggered cells: sample rolling history at sequence position
    float triggerScale = 0.0;
    if (u_hasTriggers > 0.5 && armed > 0.5) {
        angle = atan(triggerDir.y, triggerDir.x);
        // Decode 16-bit sequence index and normalize
        float seqNorm = (triggerInfo.r * 255.0 * 256.0 + triggerInfo.g * 255.0) / u_maxSequenceIndex;
        seqNorm = clamp(seqNorm, 0.0, 1.0);
        // Sample audio history at this sequence position
        float audioVal = texture2D(u_audioHistory, vec2(seqNorm, 0.5)).r;
        triggerScale = (0.3 + audioVal * u_audioActive) * armed;
    }

    float finalSpeed = max(speed, triggerScale);

    v_speed = finalSpeed;
    v_angle = angle;

    float scale = u_arrowScale * finalSpeed;

    // Rotation matrix
    float c = cos(angle);
    float s = sin(angle);
    mat2 rot = mat2(c, s, -s, c);

    float cellPixels = min(u_cellSize.x * u_resolution.x, u_cellSize.y * u_resolution.y) * 0.5;
    vec2 pixelToClip = vec2(2.0 / u_resolution.x, 2.0 / u_resolution.y);

    vec2 rotatedVertex = rot * (a_vertex * scale * cellPixels);
    vec2 pos = a_position + rotatedVertex * pixelToClip;

    gl_Position = vec4(pos, 0.0, 1.0);
}
