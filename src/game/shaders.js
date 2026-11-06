// Custom GLSL: terrain lighting (sun/moon + AO + hemispheric ambient), waving leaves,
// animated water with fresnel + sun glints, sun-aware fog, gradient sky, colour grading.
import * as THREE from 'three';

const terrainVertex = /* glsl */ `
uniform float uTime;
attribute vec3 aData; // x = ambient occlusion, y = face index, z = kind (0 solid, 1 leaves, 2 water)
varying vec2 vUv;
varying float vAO;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vKind;
varying float vDist;

const vec3 NORMALS[6] = vec3[6](
  vec3(-1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0),
  vec3(0.0, -1.0, 0.0), vec3(0.0, 1.0, 0.0),
  vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, 1.0)
);

void main() {
  vec3 p = position;
  float kind = aData.z;
  if (kind > 0.5 && kind < 1.5) {
    // leaves sway in the wind
    float w = uTime * 1.6 + p.x * 0.55 + p.z * 0.45 + p.y * 0.3;
    p.x += sin(w) * 0.045;
    p.z += cos(w * 0.8 + 1.3) * 0.045;
    p.y += sin(w * 1.3) * 0.02;
  } else if (kind > 1.5) {
    // gentle water swell
    p.y += (sin(uTime * 1.4 + p.x * 0.7 + p.z * 0.5) * 0.5 + sin(uTime * 1.1 - p.z * 0.9) * 0.5) * 0.045 - 0.04;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vAO = aData.x;
  vNormal = NORMALS[int(aData.y + 0.5)];
  vWorld = p;
  vKind = kind;
  vDist = length(mv.xyz);
}
`;

const terrainFragment = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform vec3 uFogSun;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
uniform float uAlphaTest;
uniform float uOpaque;
uniform vec3 uZenith;
uniform float uNight;

varying vec2 vUv;
varying float vAO;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vKind;
varying float vDist;

void main() {
  vec4 tex = texture2D(map, vUv);
  if (tex.a < uAlphaTest) discard;
  vec3 albedo = tex.rgb;
  vec3 N = vNormal;
  vec3 V = normalize(uCamPos - vWorld);
  float alpha = 1.0;

  bool isWater = vKind > 1.5;
  if (isWater && N.y > 0.5) {
    // ripple normal from a few travelling sine waves
    vec2 q = vWorld.xz;
    float t = uTime;
    vec2 g = vec2(
      cos(q.x * 1.3 + t * 1.5) * 0.6 + cos((q.x + q.y) * 2.1 + t * 2.3) * 0.35,
      cos(q.y * 1.7 - t * 1.2) * 0.6 + cos((q.x - q.y) * 1.9 - t * 1.9) * 0.35
    );
    N = normalize(vec3(g.x * 0.09, 1.0, g.y * 0.09));
  }

  // hemispheric ambient: tops get sky light, bottoms get bounce light
  float hemi = N.y > 0.5 ? 1.0 : N.y < -0.5 ? 0.5 : 0.78 + N.y * 0.1;
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 lighting = (uAmbient * hemi + uSunColor * ndl) * vAO;
  vec3 col = albedo * lighting;

  if (isWater) {
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 skyRefl = mix(uFogColor, uZenith, 0.35);
    col = mix(col, skyRefl, 0.25 + fres * 0.55);
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 180.0);
    col += uSunColor * spec * 2.5;
    alpha = uOpaque > 0.5 ? 1.0 : mix(0.68, 0.94, fres);
  }

  // night vision: colours fade toward a cool blue-grey
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, luma * vec3(0.7, 0.85, 1.35), uNight * 0.6);

  // fog that glows warmer toward the sun
  vec3 viewDir = normalize(vWorld - uCamPos);
  float sunAmt = pow(max(dot(viewDir, uSunDir), 0.0), 6.0);
  vec3 fogCol = mix(uFogColor, uFogSun, sunAmt);
  float f = smoothstep(uFogNear, uFogFar, vDist);
  col = mix(col, fogCol, f);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createTerrainMaterials(atlas) {
  const shared = {
    map: { value: atlas },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbient: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uFogColor: { value: new THREE.Color() },
    uFogSun: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uFogNear: { value: 60 },
    uFogFar: { value: 120 },
    uCamPos: { value: new THREE.Vector3() },
    uNight: { value: 0 },
  };
  const mk = (opts, alphaTest = 0, opaque = 0) =>
    new THREE.ShaderMaterial({
      uniforms: { ...shared, uAlphaTest: { value: alphaTest }, uOpaque: { value: opaque } },
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      ...opts,
    });
  return {
    shared,
    o: mk({}, 0.01),
    c: mk({}, 0.5),
    w: mk({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ocean: mk({}, 0, 1),
  };
}

// ---------- sky dome ----------
export function createSky(sunDirUniform) {
  const uniforms = {
    uSunDir: sunDirUniform,
    uHorizon: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uSunGlow: { value: new THREE.Color() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uZenith, uSunGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
        col = mix(col, uHorizon * 0.75, smoothstep(0.0, -0.35, h));
        float g = max(dot(d, uSunDir), 0.0);
        col += uSunGlow * (pow(g, 5.0) * 0.35 + pow(g, 48.0) * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// ---------- colour grading + vignette (post-processing pass) ----------
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.08 },
    uVignette: { value: 0.32 },
    uTint: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation, uContrast, uVignette;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = max((col - 0.18) * uContrast + 0.18, 0.0);
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * uVignette * 2.0;
      gl_FragColor = vec4(col, c.a);
    }`,
};
