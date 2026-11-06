// Procedural 16x16 pixel-art textures drawn into one atlas strip, plus item icons.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { BLOCKS, PICKAXE, SWORD, NT } from './blocks.js';

// Sword pixel art (16x16, blade pointing up). Shared by the icon and the 3D hand model.
export function swordPixels() {
  const px = [];
  for (let y = 0; y <= 10; y++) {
    if (y === 0) { px.push([7, y, '#e9f1f4'], [8, y, '#b9c6cc']); continue; }
    px.push([6, y, '#9fb0b8'], [7, y, '#eef5f7'], [8, y, '#c9d6dc'], [9, y, '#8796a0']);
  }
  for (let x = 3; x <= 12; x++) px.push([x, 11, x === 3 || x === 12 ? '#8a6a1c' : '#d9a92c']); // guard
  for (let y = 12; y <= 14; y++) px.push([7, y, '#6b4423'], [8, y, '#4e3018']);              // grip
  px.push([7, 15, '#e0b030'], [8, 15, '#b8891c']);                                         // pommel
  return px;
}

export const TS = 16;   // tile size in px

const atlas = document.createElement('canvas');
atlas.width = TS * NT;
atlas.height = TS;
const actx = atlas.getContext('2d');
const img = actx.createImageData(TS * NT, TS);
const rnd = mulberry32(4242);

function put(t, x, y, c) {
  const i = (y * TS * NT + t * TS + x) * 4;
  img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2];
  img.data[i + 3] = c.length > 3 ? c[3] : 255;
}
const vary = (c, a) => { const k = 1 + (rnd() - 0.5) * a; return [c[0] * k, c[1] * k, c[2] * k]; };
function paint(t, fn) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) put(t, x, y, fn(x, y)); }
function spots(n, r) {
  const m = new Uint8Array(256);
  for (let i = 0; i < n; i++) {
    const cx = 2 + rnd() * 12, cy = 2 + rnd() * 12;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r * (0.6 + rnd() * 0.6)) m[y * 16 + x] = 1;
  }
  return m;
}

const GRASS_C = [96, 160, 56], DIRT_C = [134, 96, 67], STONE_C = [128, 128, 128];
const BARK = [104, 80, 50], SNOW_C = [238, 244, 250];

paint(0, () => vary(GRASS_C, 0.35));                                    // grass top
const gcol = [...Array(16)].map(() => 2 + Math.floor(rnd() * 3));
paint(1, (x, y) => (y < gcol[x] ? vary(GRASS_C, 0.3) : vary(DIRT_C, 0.35))); // grass side
paint(2, () => vary(DIRT_C, 0.4));                                      // dirt
paint(3, () => vary(STONE_C, 0.22));                                    // stone
{ // cobblestone: voronoi-ish stones with dark cracks
  const pts = [...Array(9)].map(() => [rnd() * 16, rnd() * 16, 0.8 + rnd() * 0.4]);
  paint(4, (x, y) => {
    let d1 = 1e9, d2 = 1e9, k = 1;
    for (const p of pts) {
      let dx = Math.abs(x - p[0]); dx = Math.min(dx, 16 - dx);
      let dy = Math.abs(y - p[1]); dy = Math.min(dy, 16 - dy);
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; k = p[2]; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 1.1) return vary([72, 72, 72], 0.2);
    return vary([STONE_C[0] * k, STONE_C[1] * k, STONE_C[2] * k], 0.2);
  });
}
paint(5, () => vary([219, 206, 160], 0.12));                            // sand
paint(6, (x) => vary(x % 4 === 1 ? [78, 60, 37] : BARK, 0.2));          // log side
paint(7, (x, y) => {                                                    // log top
  const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  if (d > 6) return vary(BARK, 0.15);
  return vary(Math.floor(d) % 2 ? [176, 140, 88] : [150, 116, 70], 0.08);
});
paint(8, () => (rnd() < 0.2 ? [0, 0, 0, 0] : vary([60, 128, 40], 0.45))); // leaves
paint(9, () => vary([50, 100, 210], 0.12));                             // water
paint(10, (x, y) => {                                                   // planks
  if (y % 4 === 3) return [110, 84, 50];
  if (x === (Math.floor(y / 4) * 7 + 3) % 16) return [120, 92, 56];
  return vary([170, 134, 84], 0.12);
});
paint(11, (x, y) => {                                                   // glass
  if (x === 0 || y === 0 || x === 15 || y === 15) return [210, 235, 245];
  if ((x - y === 3 || x - y === 5) && x > 4 && x < 12) return [240, 250, 255];
  return [0, 0, 0, 0];
});
paint(12, (x, y) => {                                                   // bricks
  const row = Math.floor(y / 4);
  if (y % 4 === 3 || (x + (row % 2) * 4) % 8 === 0) return vary([190, 185, 175], 0.1);
  return vary([155, 64, 48], 0.25);
});
paint(13, () => vary(SNOW_C, 0.06));                                    // snow top
const scol = [...Array(16)].map(() => 3 + Math.floor(rnd() * 3));
paint(14, (x, y) => (y < scol[x] ? vary(SNOW_C, 0.06) : vary(DIRT_C, 0.35))); // snow side
paint(15, () => vary([70, 70, 70], 1.0));                               // bedrock
{ const m = spots(4, 1.7); paint(16, (x, y) => (m[y * 16 + x] ? vary([30, 30, 30], 0.3) : vary(STONE_C, 0.22))); }
{ const m = spots(4, 1.6); paint(17, (x, y) => (m[y * 16 + x] ? vary([214, 170, 140], 0.15) : vary(STONE_C, 0.22))); }
paint(18, () => (rnd() < 0.5 ? vary([120, 115, 110], 0.4) : vary([150, 140, 135], 0.3))); // gravel

actx.putImageData(img, 0, 0);
export const atlasCanvas = atlas;

function nearest(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeAtlasTexture() {
  return nearest(new THREE.CanvasTexture(atlas));
}

// 8 crack stages that grow outward from the centre
export function makeCrackTextures() {
  const r = mulberry32(99);
  const px = [];
  for (let w = 0; w < 8; w++) {
    let x = 6 + r() * 4, y = 6 + r() * 4;
    const ang = r() * Math.PI * 2;
    for (let s = 0; s < 10; s++) {
      x += Math.cos(ang) + (r() - 0.5) * 1.2;
      y += Math.sin(ang) + (r() - 0.5) * 1.2;
      const ix = Math.floor(x), iy = Math.floor(y);
      if (ix >= 0 && iy >= 0 && ix < 16 && iy < 16) px.push([ix, iy, s]);
    }
  }
  px.sort((a, b) => a[2] - b[2]);
  const out = [];
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.75)';
    const n = Math.ceil((px.length * (k + 1)) / 8);
    for (let i = 0; i < n; i++) g.fillRect(px[i][0], px[i][1], 1, 1);
    out.push(nearest(new THREE.CanvasTexture(c)));
  }
  return out;
}

export function makeSunTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd84a'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#fff6b0'; g.fillRect(2, 2, 12, 12);
  g.fillStyle = '#ffffff'; g.fillRect(4, 4, 8, 8);
  return nearest(new THREE.CanvasTexture(c));
}

export function makeMoonTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#c9d2dc'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#e8eef4'; g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#b4bfcb';
  [[3, 4, 3], [9, 2, 2], [10, 9, 4], [4, 11, 2]].forEach(([x, y, s]) => g.fillRect(x, y, s, s));
  return nearest(new THREE.CanvasTexture(c));
}

// Tileable blocky clouds via a little cellular automaton
export function makeCloudTexture() {
  const N = 64, r = mulberry32(7);
  let grid = new Uint8Array(N * N).map(() => (r() < 0.42 ? 1 : 0));
  for (let it = 0; it < 4; it++) {
    const next = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        n += grid[((y + dy + N) % N) * N + ((x + dx + N) % N)];
      next[y * N + x] = n >= 5 ? 1 : 0;
    }
    grid = next;
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  for (let i = 0; i < N * N; i++) if (grid[i]) g.fillRect(i % N, Math.floor(i / N), 1, 1);
  const t = nearest(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- Item icons (data URLs for the React UI) ----------
const iconCache = {};

function face(g, tile, ox, oy, ax, ay, bx, by, shade) {
  g.setTransform(ax / 16, ay / 16, bx / 16, by / 16, ox, oy);
  g.drawImage(atlas, tile * TS, 0, TS, TS, 0, 0, 16, 16);
  if (shade) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${shade})`;
    g.fillRect(0, 0, 16, 16);
    g.globalCompositeOperation = 'source-over';
  }
}

function drawCube(g, tex) {
  face(g, tex[0], 4, 14, 20, -10, 20, 10, 0);      // top
  face(g, tex[1], 4, 14, 20, 10, 0, 22, 0.22);     // left
  face(g, tex[1], 24, 24, 20, -10, 0, 22, 0.42);   // right
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function drawPickaxe(g) {
  const P = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1.05, 1.05); };
  g.translate(24, 24); g.rotate(Math.PI / 4); g.scale(2.5, 2.5); g.translate(-8, -8);
  for (let y = 4; y < 16; y++) { P(7, y, '#8a5a2b'); P(8, y, '#5e3b19'); }
  for (let a = -150; a <= -30; a += 2) {
    const r = (a * Math.PI) / 180;
    const x = Math.round(8 + 9 * Math.cos(r)), y = Math.round(11 + 9 * Math.sin(r));
    P(x, y, '#e3ecef'); P(x, y + 1, '#9aa6ab');
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function drawSword(g) {
  g.translate(24, 24); g.rotate(Math.PI / 4); g.scale(2.6, 2.6); g.translate(-8, -8);
  for (const [x, y, c] of swordPixels()) { g.fillStyle = c; g.fillRect(x, y, 1.05, 1.05); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

export function itemIcon(id) {
  if (iconCache[id]) return iconCache[id];
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (id === PICKAXE) drawPickaxe(g);
  else if (id === SWORD) drawSword(g);
  else drawCube(g, BLOCKS[id].tex);
  return (iconCache[id] = c.toDataURL());
}
