// First-person held item ("viewmodel"), rendered in its own scene on top of the world.
import * as THREE from 'three';
import { BLOCKS, PICKAXE, SWORD, NT, CUTOUT } from './blocks.js';
import { swordPixels } from './textures.js';

const FACE_SHADE = [0.8, 0.8, 1, 0.5, 0.65, 0.65]; // BoxGeometry order: +x -x +y -y +z -z

// ---------- held block: textured cube using the atlas ----------
function blockGeometry(id) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  const colors = [];
  const tex = BLOCKS[id].tex;
  for (let f = 0; f < 6; f++) {
    const tile = f === 2 ? tex[0] : f === 3 ? tex[2] : tex[1];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setX(i, (tile + 0.001 + uv.getX(i) * 0.998) / NT);
      colors.push(FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]);
    }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// ---------- voxel model from pixel art ----------
function voxelGeometry(pixels) {
  const pos = [], col = [], idx = [];
  const has = new Set(pixels.map(([x, y]) => `${x},${y}`));
  const c = new THREE.Color();
  // corner sets for the 6 faces of a unit cube, + their neighbour offset (in pixel space)
  const faces = [
    { n: [1, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.8 },
    { n: [-1, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.8 },
    { n: [0, -1], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 },   // up (pixel y-1)
    { n: [0, 1], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55 }, // down
    { n: null, v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.95 },   // front
    { n: null, v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.7 },    // back
  ];
  for (const [x, y, hex] of pixels) {
    c.set(hex);
    const bx = x - 8, by = 8 - y - 1, bz = -0.5;
    for (const f of faces) {
      if (f.n && has.has(`${x + f.n[0]},${y + f.n[1]}`)) continue;
      const base = pos.length / 3;
      for (const [vx, vy, vz] of f.v) {
        pos.push(bx + vx, by + vy, bz + vz);
        col.push(c.r * f.s, c.g * f.s, c.b * f.s);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

function pickaxePixels() {
  const px = new Map();
  const put = (x, y, c) => px.set(`${x},${y}`, [x, y, c]);
  for (let y = 4; y < 16; y++) { put(7, y, '#8a5a2b'); put(8, y, '#5e3b19'); }
  for (let a = -150; a <= -30; a += 2) {
    const r = (a * Math.PI) / 180;
    const x = Math.round(8 + 9 * Math.cos(r)), y = Math.round(11 + 9 * Math.sin(r));
    put(x, y + 1, '#9aa6ab');
    put(x, y, '#e3ecef');
  }
  return [...px.values()];
}

export class Hand {
  constructor(atlas) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
    this.root = new THREE.Group();      // bob / swing / equip offsets
    this.scene.add(this.root);

    this.blockMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, fog: false });
    this.cutoutMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, fog: false, side: THREE.DoubleSide });
    this.colorMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.armMat = new THREE.MeshBasicMaterial({ color: 0xd9a27a, fog: false });

    this.blockGeos = {};
    this.pickaxe = new THREE.Mesh(voxelGeometry(pickaxePixels()), this.colorMat);
    this.pickaxe.scale.setScalar(0.034);
    this.pickaxe.position.set(0.1, 0.0, 0);
    this.pickaxe.rotation.set(0.1, -1.25, 0.55);

    this.sword = new THREE.Mesh(voxelGeometry(swordPixels()), this.colorMat);
    this.sword.scale.setScalar(0.031);
    this.sword.position.set(0.05, 0.12, 0);
    this.sword.rotation.set(-0.1, -0.55, 0.42);

    this.block = new THREE.Mesh(blockGeometry(1), this.blockMat);
    this.block.scale.setScalar(0.24);
    this.block.position.set(0.08, -0.04, 0);
    this.block.rotation.set(0.42, 0.78, 0);

    const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.7);
    armGeo.translate(0, 0, 0.25);
    const armCol = [];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) armCol.push(FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]);
    armGeo.setAttribute('color', new THREE.Float32BufferAttribute(armCol, 3));
    this.armMat.vertexColors = true;
    this.arm = new THREE.Mesh(armGeo, this.armMat);
    this.arm.position.set(0.12, -0.02, 0.05);
    this.arm.rotation.set(0.45, -0.2, 0.1);

    this.holder = new THREE.Group();
    this.root.add(this.holder);

    this.current = undefined;
    this.equip = 1;      // 1 = fully lowered, 0 = in position
    this.swing = 0;      // 1 -> 0 over one swing
    this.phase = 0;      // walk bob phase
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  setItem(id) {
    if (id === this.current) return;
    this.current = id;
    this.equip = 1;
    this.holder.clear();
    if (!id) {
      this.holder.add(this.arm);
    } else if (id === PICKAXE) {
      this.holder.add(this.pickaxe);
    } else if (id === SWORD) {
      this.holder.add(this.sword);
    } else {
      if (!this.blockGeos[id]) this.blockGeos[id] = blockGeometry(id);
      this.block.geometry = this.blockGeos[id];
      this.block.material = CUTOUT[id] ? this.cutoutMat : this.blockMat;
      this.holder.add(this.block);
    }
  }

  triggerSwing() {
    if (this.swing <= 0) this.swing = 1;
  }

  update(dt, { speed, onGround, swinging, light }) {
    if (swinging) this.triggerSwing();
    this.swing = Math.max(0, this.swing - dt / 0.28);
    this.equip = Math.max(0, this.equip - dt * 5);
    if (onGround && speed > 0.5) this.phase += dt * speed * 2.1;

    const s = Math.sin((1 - this.swing) * Math.PI) * (this.swing > 0 ? 1 : 0);
    const bobX = Math.sin(this.phase) * 0.025 * Math.min(1, speed / 4);
    const bobY = -Math.abs(Math.cos(this.phase)) * 0.03 * Math.min(1, speed / 4);
    const e = this.equip * this.equip;

    this.root.position.set(0.52 + bobX - s * 0.12, -0.42 + bobY - e * 0.6 + s * 0.08, -0.78 - s * 0.12);
    this.root.rotation.set(-s * 0.9, s * 0.35, s * 0.2);

    for (const m of [this.blockMat, this.cutoutMat, this.colorMat, this.armMat]) {
      if (m === this.armMat) m.color.setHex(0xd9a27a).multiplyScalar(light);
      else m.color.setScalar(light);
    }
  }
}
