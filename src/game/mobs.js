// 🌱 Mosslings: small hopping moss creatures. They wander the grasslands, watch you
// when you're near, follow you if you hold Leaves, flee when bonked, and their
// eyes + sprout glow at night.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GRASS, WATER, LEAVES } from './blocks.js';
import { W, D, H } from './world.js';

const MAX_MOBS = 22;
const GRAV = 22;

function mossTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const r = mulberry32(31337);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = 0.75 + r() * 0.45;
    const tuft = r() < 0.12;
    g.fillStyle = tuft
      ? `rgb(${150 * k | 0},${200 * k | 0},${90 * k | 0})`
      : `rgb(${70 * k | 0},${135 * k | 0},${55 * k | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Mobs {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.spawnTimer = 0;
    this.rnd = mulberry32(Date.now() & 0xffff);

    this.bodyMat = new THREE.MeshBasicMaterial({ map: mossTexture() });
    this.darkMat = new THREE.MeshBasicMaterial({ color: 0x2f5a24 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    this.shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sproutMat = new THREE.MeshBasicMaterial({ color: 0x9be05a });
    this.flowerMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
    this.box = new THREE.BoxGeometry(1, 1, 1);
  }

  makeModel() {
    const root = new THREE.Group();
    const body = new THREE.Group(); // squash/stretch pivot at the feet
    root.add(body);
    const add = (mat, sx, sy, sz, x, y, z, parent = body) => {
      const m = new THREE.Mesh(this.box, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    add(this.bodyMat, 0.7, 0.55, 0.7, 0, 0.36, 0);            // body
    add(this.darkMat, 0.72, 0.1, 0.72, 0, 0.1, 0);            // darker base
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      add(this.darkMat, 0.16, 0.12, 0.16, sx * 0.22, 0.05, sz * 0.22); // feet
    // eyes (front = +z)
    const eyes = [];
    for (const sx of [-1, 1]) {
      eyes.push(add(this.eyeMat, 0.13, 0.17, 0.04, sx * 0.17, 0.44, 0.36));
      add(this.shineMat, 0.05, 0.05, 0.02, sx * 0.17 + 0.03, 0.48, 0.385);
    }
    // sprout on top
    add(this.darkMat, 0.05, 0.22, 0.05, 0, 0.74, 0);
    add(this.sproutMat, 0.22, 0.05, 0.1, -0.1, 0.84, 0).rotation.z = 0.4;
    add(this.sproutMat, 0.22, 0.05, 0.1, 0.1, 0.84, 0).rotation.z = -0.4;
    const flower = add(this.flowerMat, 0.1, 0.1, 0.1, 0, 0.9, 0);
    return { root, body, eyes, flower };
  }

  spawn(x, z) {
    const w = this.world;
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 2 || zi < 2 || xi >= W - 2 || zi >= D - 2) return false;
    const y = w.tops[zi * W + xi];
    if (w.get(xi, y, zi) !== GRASS || w.get(xi, y + 1, zi) !== 0 || w.get(xi, y + 2, zi) !== 0) return false;
    const model = this.makeModel();
    const mob = {
      pos: new THREE.Vector3(xi + 0.5, y + 1, zi + 0.5),
      vel: new THREE.Vector3(),
      yaw: this.rnd() * Math.PI * 2,
      targetYaw: 0,
      onGround: false,
      hopTimer: 0.5 + this.rnd() * 2,
      squash: 0,
      fleeTime: 0,
      flash: 0,
      blink: this.rnd() * 4,
      ...model,
    };
    mob.targetYaw = mob.yaw;
    model.root.position.copy(mob.pos);
    this.scene.add(model.root);
    this.list.push(mob);
    return true;
  }

  // spawn a handful near the player at game start
  populate(px, pz) {
    let n = 0;
    for (let i = 0; i < 300 && n < 8; i++) {
      const a = this.rnd() * Math.PI * 2, r = 6 + this.rnd() * 24;
      if (this.spawn(px + Math.cos(a) * r, pz + Math.sin(a) * r)) n++;
    }
  }

  // ray vs. mob bounding boxes; returns { mob, dist } or null
  raycast(origin, dir, maxD) {
    let best = null;
    const box = new THREE.Box3();
    const ray = new THREE.Ray(origin, dir);
    const hit = new THREE.Vector3();
    for (const m of this.list) {
      box.min.set(m.pos.x - 0.4, m.pos.y, m.pos.z - 0.4);
      box.max.set(m.pos.x + 0.4, m.pos.y + 0.95, m.pos.z + 0.4);
      if (ray.intersectBox(box, hit)) {
        const d = hit.distanceTo(origin);
        if (d <= maxD && (!best || d < best.dist)) best = { mob: m, dist: d };
      }
    }
    return best;
  }

  bonk(mob, fromPos) {
    const away = new THREE.Vector3(mob.pos.x - fromPos.x, 0, mob.pos.z - fromPos.z).normalize();
    mob.vel.set(away.x * 7, 6.5, away.z * 7);
    mob.onGround = false;
    mob.fleeTime = 4;
    mob.flash = 0.3;
    mob.targetYaw = Math.atan2(away.x, away.z);
  }

  isSolid(x, y, z) {
    return this.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  update(dt, player, heldId, light, night) {
    const w = this.world;
    const pp = player.pos;

    // spawn / despawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1;
      if (this.list.length < MAX_MOBS) {
        const a = this.rnd() * Math.PI * 2, r = 24 + this.rnd() * 40;
        this.spawn(pp.x + Math.cos(a) * r, pp.z + Math.sin(a) * r);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if ((m.pos.x - pp.x) ** 2 + (m.pos.z - pp.z) ** 2 > 110 * 110 || m.pos.y < -10) {
        this.scene.remove(m.root);
        this.list.splice(i, 1);
      }
    }

    const lure = heldId === LEAVES;
    for (const m of this.list) {
      const dx = pp.x - m.pos.x, dz = pp.z - m.pos.z;
      const dist = Math.hypot(dx, dz);
      const toPlayer = Math.atan2(dx, dz);
      m.fleeTime = Math.max(0, m.fleeTime - dt);
      m.flash = Math.max(0, m.flash - dt);

      // --- brain ---
      if (m.onGround) {
        m.hopTimer -= dt;
        let hopDir = null, eager = 1;
        if (m.fleeTime > 0) { hopDir = toPlayer + Math.PI; eager = 3; }
        else if (lure && dist < 14 && dist > 2.2) { hopDir = toPlayer; eager = 2.5; }
        else if (dist < 6) m.targetYaw = toPlayer; // curious: watch the player
        if (m.hopTimer <= 0) {
          if (hopDir === null && !(dist < 6 && !lure)) hopDir = m.yaw + (this.rnd() - 0.5) * 2.2;
          if (hopDir !== null) {
            m.targetYaw = hopDir;
            const sp = 2.2 * Math.min(eager, 1.6);
            m.vel.set(Math.sin(hopDir) * sp, 7.4, Math.cos(hopDir) * sp);
            m.onGround = false;
            m.squash = -0.35; // stretch on take-off
          }
          m.hopTimer = (0.6 + this.rnd() * 2.2) / eager;
        }
      }

      // turn smoothly
      let dy = m.targetYaw - m.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.yaw += dy * Math.min(1, dt * 8);

      // --- physics ---
      const inWater = w.get(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.2), Math.floor(m.pos.z)) === WATER;
      if (inWater) { m.vel.y = Math.min(m.vel.y + 30 * dt, 2.5); m.vel.x *= 0.98; m.vel.z *= 0.98; }
      else m.vel.y -= GRAV * dt;

      // horizontal: blocked by a solid block at body height (keep velocity so a hop can clear a ledge)
      const nx = m.pos.x + m.vel.x * dt;
      if (!this.isSolid(nx + Math.sign(m.vel.x) * 0.35, m.pos.y + 0.1, m.pos.z) &&
          !this.isSolid(nx + Math.sign(m.vel.x) * 0.35, m.pos.y + 0.8, m.pos.z)) m.pos.x = nx;
      const nz = m.pos.z + m.vel.z * dt;
      if (!this.isSolid(m.pos.x, m.pos.y + 0.1, nz + Math.sign(m.vel.z) * 0.35) &&
          !this.isSolid(m.pos.x, m.pos.y + 0.8, nz + Math.sign(m.vel.z) * 0.35)) m.pos.z = nz;

      // vertical
      m.pos.y += m.vel.y * dt;
      if (m.vel.y <= 0 && this.isSolid(m.pos.x, m.pos.y, m.pos.z)) {
        m.pos.y = Math.floor(m.pos.y) + 1;
        if (!m.onGround) m.squash = 0.4; // squash on landing
        m.vel.set(0, 0, 0);
        m.onGround = true;
      } else if (m.vel.y > 0 && this.isSolid(m.pos.x, m.pos.y + 0.95, m.pos.z)) {
        m.vel.y = 0;
      } else if (!this.isSolid(m.pos.x, m.pos.y - 0.05, m.pos.z)) {
        m.onGround = false;
      }
      if (m.pos.y > H + 5) m.pos.y = H + 5;

      // --- animation ---
      m.squash += (0 - m.squash) * Math.min(1, dt * 10);
      m.body.scale.set(1 + m.squash * 0.5, 1 - m.squash, 1 + m.squash * 0.5);
      m.blink -= dt;
      const blinking = m.blink < 0.12;
      if (m.blink < 0) m.blink = 2 + this.rnd() * 4;
      for (const e of m.eyes) e.scale.y = blinking ? 0.02 : 0.17;
      m.flower.rotation.y += dt * 2;
      m.root.position.copy(m.pos);
      m.root.rotation.y = m.yaw;
      m.root.visible = (m.pos.x - pp.x) ** 2 + (m.pos.z - pp.z) ** 2 < 125 * 125;
    }

    // lighting: dim with the world; eyes + flower glow at night (bloom picks it up)
    const flashing = this.list.some((m) => m.flash > 0);
    this.bodyMat.color.setScalar(light);
    if (flashing) for (const m of this.list) if (m.flash > 0) m.body.children[0].material = this.flashMat ??= new THREE.MeshBasicMaterial({ color: 0xff6666 });
    for (const m of this.list) if (m.flash <= 0 && m.body.children[0].material !== this.bodyMat) m.body.children[0].material = this.bodyMat;
    this.darkMat.color.setHex(0x2f5a24).multiplyScalar(light);
    this.sproutMat.color.setHex(0x9be05a).multiplyScalar(light + night * 1.6);
    this.flowerMat.color.setHex(0xffd34d).multiplyScalar(light + night * 3.5);
    this.eyeMat.color.setHex(0x111111).lerp(new THREE.Color(0x9dff7a), night).multiplyScalar(1 + night * 2.5);
    this.shineMat.color.setScalar(light + night * 2);
  }
}
