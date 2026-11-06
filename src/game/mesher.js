// Builds chunk geometry: only faces touching non-opaque neighbours, with baked
// face shading + per-vertex ambient occlusion. Three buckets: opaque, cutout, water.
import { AIR, WATER, GLASS, LEAVES, BLOCKS, OPAQUE, CUTOUT, NT } from './blocks.js';
import { W, H, CS } from './world.js';

const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
for (const f of FACES) {
  f.axis = f.dir.findIndex((v) => v !== 0);
  f.u = (f.axis + 1) % 3;
  f.v = (f.axis + 2) % 3;
}
const AOV = [0.45, 0.64, 0.82, 1];

// d = per-vertex shader data: [ambient occlusion, face index, kind]
const newBuf = () => ({ p: [], uv: [], d: [], i: [] });

function visible(b, n) {
  if (b === WATER) return !OPAQUE[n] && n !== WATER;
  if (b === GLASS) return !OPAQUE[n] && n !== GLASS;
  return !OPAQUE[n];
}

export function buildChunk(world, cx, cz) {
  const out = { o: newBuf(), c: newBuf(), w: newBuf() };
  const x0 = cx * CS, z0 = cz * CS;
  const q = [0, 0, 0];
  const occ = (a, b, c) => OPAQUE[world.get(a, b, c)];

  for (let z = z0; z < z0 + CS; z++) {
    for (let x = x0; x < x0 + CS; x++) {
      const top = Math.min(H - 1, world.tops[z * W + x]);
      const col = (z * W + x) * H;
      for (let y = 0; y <= top; y++) {
        const b = world.data[col + y];
        if (b === AIR) continue;
        const def = BLOCKS[b];
        const buf = b === WATER ? out.w : CUTOUT[b] ? out.c : out.o;
        const waterTop = b === WATER && world.get(x, y + 1, z) !== WATER;
        const kind = b === WATER ? 2 : b === LEAVES ? 1 : 0;

        for (let fi = 0; fi < 6; fi++) {
          const f = FACES[fi];
          const [dx, dy, dz] = f.dir;
          const n = world.get(x + dx, y + dy, z + dz);
          if (!visible(b, n)) continue;
          const tile = def.tex[dy === 1 ? 0 : dy === -1 ? 2 : 1];
          const ndx = buf.p.length / 3;
          const ao = [3, 3, 3, 3];
          for (let k = 0; k < 4; k++) {
            const c = f.corners[k];
            let py = y + c[1];
            if (waterTop && c[1] === 1) py -= 0.12;
            buf.p.push(x + c[0], py, z + c[2]);
            buf.uv.push((tile + 0.001 + c[3] * 0.998) / NT, c[4]);
            if (b !== WATER) {
              // neighbours in the layer in front of the face
              q[0] = x + dx; q[1] = y + dy; q[2] = z + dz;
              const su = c[f.u] ? 1 : -1, sv = c[f.v] ? 1 : -1;
              q[f.u] += su; const s1 = occ(q[0], q[1], q[2]);
              q[f.v] += sv; const cr = occ(q[0], q[1], q[2]);
              q[f.u] -= su; const s2 = occ(q[0], q[1], q[2]);
              ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
            }
            buf.d.push(AOV[ao[k]], fi, kind);
          }
          if (ao[0] + ao[3] > ao[1] + ao[2]) buf.i.push(ndx, ndx + 1, ndx + 3, ndx, ndx + 3, ndx + 2);
          else buf.i.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
        }
      }
    }
  }
  return out;
}
