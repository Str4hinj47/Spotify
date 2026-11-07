/** Shared world-space cloud shadow pattern for terrain and road surfaces. */
export const CLOUD_SHADOW_GLSL = `
  uniform float cloudShadowStrength, cloudShadowTime;
  float cloudShadowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cloudShadowNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cloudShadowHash(i), cloudShadowHash(i + vec2(1.0, 0.0)), f.x),
               mix(cloudShadowHash(i + vec2(0.0, 1.0)), cloudShadowHash(i + vec2(1.0)), f.x), f.y);
  }
  float cloudShadowAt(vec2 worldPosition) {
    if (cloudShadowStrength < 0.001) return 1.0;
    vec2 p = worldPosition * 0.012 + vec2(cloudShadowTime * 0.006, cloudShadowTime * 0.002);
    float cloud = cloudShadowNoise(p) * 0.7 + cloudShadowNoise(p * 2.1 + 17.3) * 0.3;
    return 1.0 - cloudShadowStrength * smoothstep(0.38, 0.68, cloud);
  }
`;
