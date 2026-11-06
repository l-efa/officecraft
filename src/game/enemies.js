// 👁 The Gloom: a tall shadow creature with one glowing violet eye.
// Spawns at night on the surface and in dark caves by day. Walks toward the player
// (same physics as the player), jumps ledges, hits for 1.5 hearts. Only a sword hurts it.
// Surface Glooms dissolve when the sun comes up.
import * as THREE from 'three';
import { Player } from './player.js';
import { mulberry32 } from './noise.js';
import { W, D, H } from './world.js';
import { AIR, WATER } from './blocks.js';

const MAX = 10;
export const GLOOM_HP = 12;
const SPEED = 3.3;
const ATTACK_DMG = 3;          // 1.5 hearts
const ATTACK_RANGE = 1.5;
const ATTACK_COOLDOWN = 1.1;
const AGGRO = 22;

export class Enemies {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.spawnTimer = 2;
    this.rnd = mulberry32((Date.now() >> 3) & 0xffff);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a1426 });
    this.limbMat = new THREE.MeshBasicMaterial({ color: 0x0f0b18 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xc77dff });
    this.pupilMat = new THREE.MeshBasicMaterial({ color: 0x14001f });
    this.hurtMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  }

  makeModel() {
    const root = new THREE.Group();
    const parts = [];
    const add = (mat, sx, sy, sz, x, y, z, parent = root) => {
      const m = new THREE.Mesh(this.box, mat);
      m.scale.set(sx, sy, sz); m.position.set(x, y, z);
      parent.add(m); parts.push(m);
      return m;
    };
    // legs pivot at the hip
    const legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.14, 0.75, 0); root.add(pivot);
      add(this.limbMat, 0.18, 0.75, 0.18, 0, -0.375, 0, pivot);
      return pivot;
    });
    add(this.bodyMat, 0.55, 0.75, 0.32, 0, 1.12, 0);                    // torso
    const head = new THREE.Group(); head.position.set(0, 1.72, 0); root.add(head);
    add(this.bodyMat, 0.56, 0.5, 0.5, 0, 0, 0, head);                    // head
    add(this.eyeMat, 0.3, 0.22, 0.04, 0, 0.02, 0.26, head);              // the eye
    add(this.pupilMat, 0.08, 0.16, 0.03, 0, 0.02, 0.285, head);
    for (const s of [-1, 1]) add(this.limbMat, 0.08, 0.2, 0.08, s * 0.2, 0.33, 0, head).rotation.z = -s * 0.35; // horns
    // long arms reaching forward
    const arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.37, 1.42, 0); root.add(pivot);
      add(this.limbMat, 0.14, 0.14, 0.75, 0, -0.05, 0.33, pivot);
      return pivot;
    });
    return { root, parts, legs, arms, head };
  }

  spawnAt(x, y, z, underground) {
    const body = new Player();
    body.pos = { x, y, z };
    const model = this.makeModel();
    const e = {
      body, ...model, hp: GLOOM_HP, cooldown: 0, hurt: 0, walk: 0,
      underground, dying: 0, wander: this.rnd() * Math.PI * 2, wanderT: 0,
    };
    model.root.position.set(x, y, z);
    this.scene.add(model.root);
    this.list.push(e);
  }

  // find a 2-tall air gap with solid ground below
  trySpawn(px, pz, night) {
    const w = this.world;
    const a = this.rnd() * Math.PI * 2, r = 18 + this.rnd() * 26;
    const x = Math.floor(px + Math.cos(a) * r), z = Math.floor(pz + Math.sin(a) * r);
    if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) return;
    const top = w.tops[z * W + x];
    if (night && this.rnd() < 0.7) {
      // surface
      const g = w.get(x, top, z);
      if (g === WATER || g === AIR || w.get(x, top + 1, z) !== AIR || w.get(x, top + 2, z) !== AIR) return;
      this.spawnAt(x + 0.5, top + 1, z + 0.5, false);
    } else {
      // cave: random y well below the surface
      const y = 5 + Math.floor(this.rnd() * Math.max(1, top - 10));
      if (y >= top - 4) return;
      if (w.isSolid(x, y - 1, z) && w.get(x, y, z) === AIR && w.get(x, y + 1, z) === AIR)
        this.spawnAt(x + 0.5, y, z + 0.5, true);
    }
  }

  raycast(origin, dir, maxD) {
    let best = null;
    const box = new THREE.Box3(), ray = new THREE.Ray(origin, dir), hit = new THREE.Vector3();
    for (const e of this.list) {
      if (e.dying) continue;
      const p = e.body.pos;
      box.min.set(p.x - 0.35, p.y, p.z - 0.35);
      box.max.set(p.x + 0.35, p.y + 2.0, p.z + 0.35);
      if (ray.intersectBox(box, hit)) {
        const d = hit.distanceTo(origin);
        if (d <= maxD && (!best || d < best.dist)) best = { enemy: e, dist: d };
      }
    }
    return best;
  }

  /** returns true if it died */
  damage(e, amount, fromPos) {
    e.hp -= amount;
    e.hurt = 0.25;
    const dx = e.body.pos.x - fromPos.x, dz = e.body.pos.z - fromPos.z;
    const l = Math.hypot(dx, dz) || 1;
    e.body.vel.x = (dx / l) * 9; e.body.vel.z = (dz / l) * 9; e.body.vel.y = 5;
    e.stun = 0.35;
    if (e.hp <= 0) { e.dying = 0.6; return true; }
    return false;
  }

  remove(i) {
    this.scene.remove(this.list[i].root);
    this.list.splice(i, 1);
  }

  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
  }

  /** onHit(damage, fromPos) is called when a Gloom lands a hit on the player */
  update(dt, player, day, onHit) {
    const pp = player.pos;
    const night = day < 0.35;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = night ? 1.5 : 4;
      if (this.list.length < MAX) this.trySpawn(pp.x, pp.z, night);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const b = e.body;
      const dx = pp.x - b.pos.x, dz = pp.z - b.pos.z, dy = pp.y - b.pos.y;
      const dist = Math.hypot(dx, dz);

      if (dist > 90) { this.remove(i); continue; }

      // dying: shrink and sink into shadow
      if (e.dying) {
        e.dying -= dt;
        const s = Math.max(0.01, e.dying / 0.6);
        e.root.scale.set(s, s, s);
        e.root.rotation.z += dt * 6;
        if (e.dying <= 0) this.remove(i);
        continue;
      }
      // surface Glooms dissolve in daylight
      if (!e.underground && day > 0.6) { e.dying = 0.6; continue; }

      e.cooldown = Math.max(0, e.cooldown - dt);
      e.hurt = Math.max(0, e.hurt - dt);
      e.stun = Math.max(0, (e.stun || 0) - dt);

      // --- brain ---
      let forward = 0, jump = false;
      const chasing = dist < AGGRO && Math.abs(dy) < 8;
      if (e.stun > 0) {
        forward = 0;
      } else if (chasing) {
        b.yaw = Math.atan2(-dx, -dz); // Player.update moves along -sin/-cos(yaw)
        forward = dist > 1.1 ? SPEED / 4.3 : 0;
        jump = b.hitWall;
        if (dist < ATTACK_RANGE && Math.abs(dy) < 1.6 && e.cooldown <= 0) {
          e.cooldown = ATTACK_COOLDOWN;
          e.lunge = 0.25;
          onHit(ATTACK_DMG, b.pos);
        }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wander = this.rnd() * Math.PI * 2; e.wanderT = 2 + this.rnd() * 3; }
        b.yaw = e.wander;
        forward = 0.4;
        jump = b.hitWall;
      }

      const savedVx = b.vel.x, savedVz = b.vel.z;
      b.update(dt, { forward, strafe: 0, jump, sprint: false }, this.world);
      if (e.stun > 0) { b.vel.x = savedVx * 0.92; b.vel.z = savedVz * 0.92; } // keep knockback

      // --- animation ---
      const speed = Math.hypot(b.vel.x, b.vel.z);
      e.walk += dt * speed * 2.4;
      const swing = Math.sin(e.walk) * Math.min(1, speed / 2) * 0.7;
      e.legs[0].rotation.x = swing; e.legs[1].rotation.x = -swing;
      e.lunge = Math.max(0, (e.lunge || 0) - dt);
      const reach = e.lunge > 0 ? -0.6 : 0;
      e.arms[0].rotation.x = -swing * 0.3 + reach; e.arms[1].rotation.x = swing * 0.3 + reach;
      e.head.rotation.z = Math.sin(e.walk * 0.5) * 0.08; // creepy head tilt
      e.root.position.set(b.pos.x, b.pos.y, b.pos.z);
      e.root.rotation.y = b.yaw + Math.PI; // model faces +z, movement faces -z
      for (const m of e.parts) {
        if (m.material === this.eyeMat || m.material === this.pupilMat) continue;
        const base = m.userData.base ?? (m.userData.base = m.material);
        m.material = e.hurt > 0 ? this.hurtMat : base;
      }
    }

    // the eye always glows (strongly at night so bloom catches it)
    this.eyeMat.color.setHex(0xc77dff).multiplyScalar(1.4 + (1 - day) * 2.5);
  }
}
