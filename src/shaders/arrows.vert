precision highp float;

attribute vec2 a_position;    // grid position (-1..1)
attribute vec2 a_vertex;      // wedge geometry vertex

uniform vec2 u_resolution;
uniform sampler2D u_velocityField;
uniform sampler2D u_pathMap;
uniform sampler2D u_audioHistory;  // 256x1 luminance: rolling delta history
uniform float u_audioActive;
uniform float u_hasPath;
uniform float u_time;
uniform float u_arrowScale;
uniform vec2 u_cellSize;

varying float v_speed;
varying float v_angle;

const float PI = 3.14159265359;

void main() {
    vec2 uv = a_position * 0.5 + 0.5;

    // Sample path map: R=t_high, G=t_low, B=angle, A=proximity
    vec4 pathInfo = texture2D(u_pathMap, uv);
    float proximity = pathInfo.a;

    // Decode direction from angle byte
    float dirAngle = pathInfo.b * 2.0 * PI - PI;
    vec2 pathDir = vec2(cos(dirAngle), sin(dirAngle));

    // Sample velocity field
    vec4 vel = texture2D(u_velocityField, uv);
    vec2 velocity = vel.xy * 2.0 - 1.0;

    float speed = length(velocity);
    speed = speed < 0.04 ? 0.0 : speed;
    float angle = atan(velocity.y, velocity.x);

    // Audio drives arrow size on the path: sample rolling history at path t
    float pathScale = 0.0;
    if (u_hasPath > 0.5 && proximity > 0.01) {
        angle = atan(pathDir.y, pathDir.x);
        // Decode 16-bit path parameter from R (high) + G (low)
        float pathT = pathInfo.r * (256.0 / 257.0) + pathInfo.g * (1.0 / 257.0);
        // Sample audio history at this path position (newest at 0, oldest at 1)
        float audioVal = texture2D(u_audioHistory, vec2(pathT, 0.5)).r;
        // Use proximity as a gate (smoothstep threshold), not a multiplier
        float onPath = smoothstep(0.01, 0.1, proximity);
        // Base size for arrows on the path + audio adds on top
        pathScale = (0.3 + audioVal * u_audioActive) * onPath;
    }

    float finalSpeed = max(speed, pathScale);

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
