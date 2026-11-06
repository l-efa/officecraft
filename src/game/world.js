// World storage + generation. Data is column-major: index = (z*W + x)*H + y
import {
  AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, WATER, SNOW, BEDROCK,
  COAL_ORE, IRON_ORE, GRAVEL, SOLID, COBBLE, PLANKS, GLASS, BRICK,
} from './blocks.js';
import { makeNoise2D, makeNoise3D, fbm2, mulberry32 } from './noise.js';

export const W = 512, D = 512, H = 96, CS = 16, WATER_LEVEL = 32;

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export class World {
  constructor() {
    this.data = new Uint8Array(W * D * H);
    this.tops = new Uint8Array(W * D); // highest non-air y per column (may be stale-high)
  }

  get(x, y, z) {
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return AIR;
    if (y < 0) return BEDROCK;
    return this.data[(z * W + x) * H + y];
  }

  isSolid(x, y, z) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 0) return true; // invisible walls
    if (y >= H) return false;
    return SOLID[this.data[(z * W + x) * H + y]] === 1;
  }

  set(x, y, z, b) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return;
    this.data[(z * W + x) * H + y] = b;
    if (b !== AIR && y > this.tops[z * W + x]) this.tops[z * W + x] = y;
  }

  // Voxel DDA raycast. Returns first non-air, non-water block hit.
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = dx ? Math.abs(1 / dx) : Infinity;
    const tdy = dy ? Math.abs(1 / dy) : Infinity;
    const tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
    let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
    let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxD) {
      const b = this.get(x, y, z);
      if (b !== AIR && b !== WATER) return { x, y, z, nx, ny, nz, id: b };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }

  async generate(seed, onProgress) {
    const d = this.data;
    d.fill(0);
    const n1 = makeNoise2D(seed), n2 = makeNoise2D(seed + 11), n3 = makeNoise2D(seed + 23);
    const n4 = makeNoise2D(seed + 37), n5 = makeNoise2D(seed + 41);
    const c1 = makeNoise3D(seed + 51), c2 = makeNoise3D(seed + 67);
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const heights = new Int16Array(W * D);

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        // --- height ---
        const e = Math.min(x, z, W - 1 - x, D - 1 - z);
        const t = Math.min(1, e / 64);
        const edge = t * t * (3 - 2 * t); // smoothstep falloff -> island
        const base = fbm2(n1, x / 110, z / 110, 4);
        const hills = fbm2(n2, x / 36, z / 36, 3);
        const m = fbm2(n3, x / 170, z / 170, 3);
        let h = WATER_LEVEL + 3 + base * 16 + hills * 5 + Math.pow(Math.max(0, m + 0.05), 1.5) * 85;
        const seabed = WATER_LEVEL - 14;
        h = seabed + (h - seabed) * edge;
        h = Math.max(4, Math.min(H - 16, Math.floor(h)));
        heights[z * W + x] = h;

        // --- layers ---
        const col = (z * W + x) * H;
        const beach = h <= WATER_LEVEL + 1;
        const deep = h < WATER_LEVEL - 5;
        const snowLine = 66 + Math.floor(n4(x / 12, z / 12) * 5);
        const rocky = !beach && h >= 58;
        const sub = beach ? (deep ? GRAVEL : SAND) : rocky ? STONE : DIRT;
        const top = beach ? (deep ? GRAVEL : SAND) : h >= snowLine ? SNOW : rocky ? STONE : GRASS;
        const dirtDepth = 3 + Math.floor((n4(x / 7 + 50, z / 7) + 1) * 1.5);
        const maxY = Math.max(h, WATER_LEVEL);
        for (let y = 0; y <= maxY; y++) {
          let b;
          if (y === 0 || (y < 3 && rnd() < 0.5)) b = BEDROCK;
          else if (y < h - dirtDepth) b = STONE;
          else if (y < h) b = sub;
          else if (y === h) b = top;
          else b = WATER;
          d[col + y] = b;
        }

        // --- spaghetti caves: where two 3D noise fields are both near zero ---
        const caveTop = beach ? h - 7 : h;
        for (let y = 4; y <= caveTop; y++) {
          const a = c1(x / 34, y / 20, z / 34);
          const b = c2(x / 34, y / 20, z / 34);
          if (a * a + b * b < 0.0055) d[col + y] = AIR;
        }
      }
      if ((z & 15) === 15) {
        onProgress?.((z / D) * 0.85, 'Shaping the land…');
        await yieldFrame();
      }
    }

    // --- ores ---
    onProgress?.(0.86, 'Burying ores…');
    await yieldFrame();
    for (let i = 0; i < 14000; i++) {
      let x = Math.floor(rnd() * W), z = Math.floor(rnd() * D), y = 3 + Math.floor(rnd() * 55);
      const ore = y < 28 && rnd() < 0.35 ? IRON_ORE : COAL_ORE;
      const n = 3 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        if (x >= 0 && z >= 0 && x < W && z < D && y > 0 && y < H && d[(z * W + x) * H + y] === STONE)
          d[(z * W + x) * H + y] = ore;
        const dir = Math.floor(rnd() * 3);
        const s = rnd() < 0.5 ? -1 : 1;
        if (dir === 0) x += s; else if (dir === 1) y += s; else z += s;
      }
    }

    // --- trees (denser in forest patches) ---
    onProgress?.(0.9, 'Planting trees…');
    await yieldFrame();
    for (let z = 3; z < D - 3; z++) {
      for (let x = 3; x < W - 3; x++) {
        const h = heights[z * W + x];
        if (d[(z * W + x) * H + h] !== GRASS || d[(z * W + x) * H + h + 1] !== AIR) continue;
        const forest = Math.max(0, fbm2(n5, x / 70, z / 70, 2));
        if (rnd() < 0.002 + forest * 0.06) this.placeTree(x, h, z, rnd);
      }
    }

    // --- structures: cottages + ruined towers ---
    onProgress?.(0.93, 'Building villages…');
    await yieldFrame();
    this.placeStructures(heights, rnd);

    // --- column tops for the mesher ---
    for (let i = 0; i < W * D; i++) {
      let y = H - 1;
      const col = i * H;
      while (y > 0 && d[col + y] === AIR) y--;
      this.tops[i] = y;
    }
    this.heights = heights;
    onProgress?.(0.95, 'Almost there…');
  }

  placeTree(x, y, z, rnd) {
    const d = this.data;
    const th = 4 + Math.floor(rnd() * 3);
    if (y + th + 2 >= H) return;
    // don't grow into another tree's trunk
    for (let i = 1; i <= th + 1; i++) if (d[(z * W + x) * H + y + i] !== AIR && d[(z * W + x) * H + y + i] !== LEAVES) return;
    for (let i = 1; i <= th; i++) d[(z * W + x) * H + y + i] = LOG;
    const top = y + th;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= -1 ? 2 : 1;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || rnd() < 0.5)) continue;
        const i = ((z + dz) * W + (x + dx)) * H + top + dy;
        if (d[i] === AIR) d[i] = LEAVES;
      }
    }
  }

  setRaw(x, y, z, b) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 1 || y >= H) return;
    this.data[(z * W + x) * H + y] = b;
  }

  placeStructures(heights, rnd) {
    const placed = [];
    const tryPlace = (size, minGap) => {
      for (let attempt = 0; attempt < 60; attempt++) {
        const x0 = 24 + Math.floor(rnd() * (W - 48 - size));
        const z0 = 24 + Math.floor(rnd() * (D - 48 - size));
        const cx = x0 + (size >> 1), cz = z0 + (size >> 1);
        if (placed.some(([px, pz]) => Math.hypot(px - cx, pz - cz) < minGap)) continue;
        let lo = 999, hi = -1;
        for (let z = z0; z < z0 + size; z++) for (let x = x0; x < x0 + size; x++) {
          const h = heights[z * W + x];
          lo = Math.min(lo, h); hi = Math.max(hi, h);
        }
        const base = heights[cz * W + cx];
        if (hi - lo > 2 || lo <= WATER_LEVEL + 1 || base > H - 20) continue;
        if (this.data[(cz * W + cx) * H + base] !== GRASS) continue;
        placed.push([cx, cz]);
        return { x0, z0, base };
      }
      return null;
    };

    // clear the space above and put a stone foundation under the footprint
    const prepare = (x0, z0, sx, sz, base, clearH) => {
      for (let z = z0 - 1; z <= z0 + sz; z++) for (let x = x0 - 1; x <= x0 + sx; x++) {
        const inside = x >= x0 && x < x0 + sx && z >= z0 && z < z0 + sz;
        for (let y = base + 1; y <= base + clearH; y++) this.setRaw(x, y, z, AIR);
        if (inside) for (let y = base; y > base - 6; y--) {
          const cur = this.data[(z * W + x) * H + y];
          if (y < base && cur !== AIR && cur !== WATER) break;
          this.setRaw(x, y, z, COBBLE);
        } else if (this.data[(z * W + x) * H + base] === AIR) this.setRaw(x, base, z, GRASS);
      }
    };

    // ---- cottages ----
    for (let i = 0; i < 26; i++) {
      const s = tryPlace(7, 18);
      if (!s) break;
      const { x0, z0, base } = s;
      const S = 7;
      prepare(x0, z0, S, S, base, 10);
      for (let z = z0; z < z0 + S; z++) for (let x = x0; x < x0 + S; x++) this.setRaw(x, base, z, PLANKS);
      const doorSide = Math.floor(rnd() * 4);
      for (let y = base + 1; y <= base + 3; y++) {
        for (let k = 0; k < S; k++) {
          const ring = [[x0 + k, z0, 0], [x0 + k, z0 + S - 1, 1], [x0, z0 + k, 2], [x0 + S - 1, z0 + k, 3]];
          for (const [x, z, side] of ring) {
            const corner = (k === 0 || k === S - 1);
            let b = corner ? LOG : PLANKS;
            const mid = k === 3;
            if (!corner && y === base + 2 && (k === 1 || k === 5) && side !== doorSide) b = GLASS;
            if (mid && side === doorSide && y <= base + 2) b = AIR;
            this.setRaw(x, y, z, b);
          }
        }
      }
      // stepped brick roof with overhang
      for (let k = 0; k <= 4; k++) {
        const y = base + 4 + k;
        const a = -1 + k, b2 = S - k;
        if (a > b2) break;
        for (let z = z0 + a; z <= z0 + b2; z++) for (let x = x0 + a; x <= x0 + b2; x++) {
          const edge = x === x0 + a || x === x0 + b2 || z === z0 + a || z === z0 + b2;
          if (edge || a === b2 || b2 - a <= 1) this.setRaw(x, y, z, BRICK);
        }
      }
      // a little path of gravel out of the door
      const [ddx, ddz, dx0, dz0] = [[0, -1, x0 + 3, z0 - 1], [0, 1, x0 + 3, z0 + S], [-1, 0, x0 - 1, z0 + 3], [1, 0, x0 + S, z0 + 3]][doorSide];
      for (let k = 0; k < 4; k++) {
        const px = dx0 + ddx * k, pz = dz0 + ddz * k;
        if (px < 0 || pz < 0 || px >= W || pz >= D) break;
        const h = heights[pz * W + px];
        if (this.data[(pz * W + px) * H + h] === GRASS) this.setRaw(px, h, pz, GRAVEL);
      }
    }

    // ---- ruined towers ----
    for (let i = 0; i < 10; i++) {
      const s = tryPlace(5, 40);
      if (!s) break;
      const { x0, z0, base } = s;
      const S = 5, TH = 10 + Math.floor(rnd() * 5);
      prepare(x0, z0, S, S, base, TH + 3);
      for (let y = base; y <= base + TH; y++) {
        const decay = Math.max(0, (y - base) / TH - 0.35) * 0.9; // crumbles toward the top
        const floor = (y - base) % 5 === 0;
        for (let z = z0; z < z0 + S; z++) for (let x = x0; x < x0 + S; x++) {
          const edge = x === x0 || x === x0 + S - 1 || z === z0 || z === z0 + S - 1;
          const corner = (x === x0 || x === x0 + S - 1) && (z === z0 || z === z0 + S - 1);
          if (edge) {
            if (rnd() < decay && !corner) continue;
            const isDoor = z === z0 && x === x0 + 2 && y > base && y <= base + 2;
            const isWindow = !corner && (y - base) % 5 === 3 && (x === x0 + 2 || z === z0 + 2);
            if (isDoor || isWindow) continue;
            this.setRaw(x, y, z, rnd() < 0.15 ? STONE : COBBLE);
          } else if (floor) this.setRaw(x, y, z, y === base ? COBBLE : PLANKS);
        }
      }
      // ladder-ish holes in floors so you can climb with jumps: open one corner
      for (let y = base + 5; y <= base + TH; y += 5) this.setRaw(x0 + 1, y, z0 + 3, AIR);
      // stairs of cobble up the inside wall (1 per level)
      for (let y = base + 1; y <= base + TH; y++) {
        const k = (y - base - 1) % 4;
        const [sx, sz] = [[x0 + 1, z0 + 1], [x0 + 3, z0 + 1], [x0 + 3, z0 + 3], [x0 + 1, z0 + 3]][k];
        this.setRaw(sx, y, sz, COBBLE);
      }
      // battlements
      const top = base + TH + 1;
      for (let k = 0; k < S; k += 2) {
        for (const [x, z] of [[x0 + k, z0], [x0 + k, z0 + S - 1], [x0, z0 + k], [x0 + S - 1, z0 + k]])
          if (rnd() > 0.3) this.setRaw(x, top, z, COBBLE);
      }
    }
    this.structures = placed.length;
  }

  findSpawn() {
    const cx = W / 2, cz = D / 2;
    for (let r = 0; r < W / 2; r += 2) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = Math.floor(cx + Math.cos(a) * r), z = Math.floor(cz + Math.sin(a) * r);
        const y = this.tops[z * W + x];
        if (this.get(x, y, z) === GRASS) return { x: x + 0.5, y: y + 1, z: z + 0.5 };
      }
    }
    return { x: cx + 0.5, y: H - 4, z: cz + 0.5 };
  }
}
